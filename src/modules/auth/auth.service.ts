import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { TokenDto } from './dto/token.dto';
import { RefreshTokenService } from './refresh-token.service';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { AccessTokenPayloadDto } from './dto/access-token-payload.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { JwtTokenService } from './jwt-token.service';
import { RefreshTokenPayloadDto } from './dto/refresh-token-payload.dto';
import { PasswordService } from '../../common/services/password.service';
import { ZaloAuthService } from './zalo-auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import {
  userWithEmployeeInclude,
  userWithRoleInclude,
} from '@modules/users/user.types';
import { employeeWithBranchesInclude } from '@modules/employees/employee.types';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

const authUserInclude = {
  ...userWithRoleInclude,
  ...userWithEmployeeInclude,
  managerBranches: true,
  zaloIdentity: true,
} satisfies Prisma.UserInclude;

type AuthUser = Prisma.UserGetPayload<{
  include: typeof authUserInclude;
}>;

const devAuthEmployeeInclude = {
  user: {
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      managerBranches: true,
    },
  },
  employeeBranches: {
    include: {
      branch: true,
    },
  },
} satisfies Prisma.EmployeeInclude;

type DevAuthEmployee = Prisma.EmployeeGetPayload<{
  include: typeof devAuthEmployeeInclude;
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordService: PasswordService,
    private readonly zaloAuthService: ZaloAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Zalo Mini App login.
   * The access token is verified with Zalo first. Phone token is only used to
   * link a verified Zalo identity to a pre-registered StaffHub user.
   */
  async loginWithZalo(zaloLoginDto: ZaloLoginDto): Promise<TokenDto> {
    const { accessToken, phoneToken } = zaloLoginDto;

    const zaloProfile =
      await this.zaloAuthService.verifyAccessToken(accessToken);
    const zaloUserId = zaloProfile.zaloUserId;

    if (!zaloUserId) {
      throw new UnauthorizedException('Invalid Zalo access token');
    }

    const existingIdentity = await this.prisma.zaloIdentity.findUnique({
      where: { zaloUserId },
      include: {
        user: {
          include: authUserInclude,
        },
      },
    });

    if (existingIdentity) {
      await this.prisma.zaloIdentity.update({
        where: { id: existingIdentity.id },
        data: {
          displayName: zaloProfile.fullName,
          avatarUrl: zaloProfile.avatarUrl,
          lastVerifiedAt: new Date(),
        },
      });

      return this.createTokenPairForUser(existingIdentity.user);
    }

    if (!phoneToken) {
      throw new UnauthorizedException(
        'Phone permission is required to link this Zalo account.',
      );
    }

    const zaloPhoneProfile = await this.zaloAuthService.getPhoneNumber(
      accessToken,
      phoneToken,
    );

    const phoneCandidates = this.getPhoneNumberCandidates(
      zaloPhoneProfile.phoneNumber,
    );

    const user = await this.prisma.user.findFirst({
      where: {
        phoneNumber: {
          in: phoneCandidates,
        },
      },
      include: authUserInclude,
    });

    if (!user) {
      throw new NotFoundException(
        'Your phone number is not registered in the system. Please contact your manager to register.',
      );
    }

    if (user.zaloIdentity && user.zaloIdentity.zaloUserId !== zaloUserId) {
      throw new ForbiddenException(
        'This StaffHub account is already linked to another Zalo account.',
      );
    }

    await this.prisma.zaloIdentity.create({
      data: {
        userId: user.id,
        zaloUserId,
        displayName: zaloProfile.fullName,
        avatarUrl: zaloProfile.avatarUrl,
        lastVerifiedAt: new Date(),
      },
    });

    return this.createTokenPairForUser(user);
  }

  async login(user: AuthenticatedUserDto): Promise<TokenDto> {
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.userId,
      phone: user.phone,
      empId: user.employeeId,
      roles: user.roles,
      branches: user.branches,
      managedBranches: user.managedBranches,
    });

    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        sub: user.userId,
        phone: user.phone,
        empId: user.employeeId,
        roles: user.roles,
        branches: user.branches,
        managedBranches: user.managedBranches,
      });

    return {
      accessToken,
      refreshToken,
    };
  }

  async loginWithDev(
    devLoginDto: DevLoginDto,
    devAuthSecret: string | undefined,
    context?: {
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<AuthSessionResponseDto> {
    this.assertDevAuthEnabled();
    this.assertValidDevAuthSecret(devAuthSecret);

    const employee = await this.findDevLoginEmployee(devLoginDto);

    if (!employee) {
      throw new NotFoundException('DEV_EMPLOYEE_NOT_FOUND');
    }

    if (!employee.user || employee.user.status !== 'ACTIVE') {
      throw new ForbiddenException('EMPLOYEE_INACTIVE');
    }

    const session = await this.issueAuthSessionForEmployee(employee, {
      source: 'DEV_LOGIN',
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress,
    });

    this.logger.log(
      `Dev login successful employeeId=${employee.id} source=DEV_LOGIN`,
    );

    return session;
  }

  async refreshToken(refreshSession: RefreshSessionDto): Promise<TokenDto> {
    const { userId: userId } = refreshSession;

    // const isValid = await this.refreshTokenService.validateRefreshToken(
    //   userId,
    //   refreshToken,
    // );

    // if (!isValid) {
    //   throw new ForbiddenException('Invalid refresh token');
    // }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userWithBranches = await this.getEmployeeWithBranches(user);
    const roles = user.userRoles.map((ur) => ur.role.name);
    const managedBranches = user.managerBranches.map((mb) => mb.branchId);

    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      phone: user.phoneNumber,
      empId: user.employee?.id || undefined,
      roles,
      branches: userWithBranches.employeeBranches.map((eb) => eb.branch.id),
      managedBranches,
    });

    const { token: refreshToken } =
      await this.refreshTokenService.rotateRefreshToken(
        refreshSession.tokenId,
        {
          sub: user.id,
          phone: user.phoneNumber,
          empId: user.employee?.id || undefined,
          roles,
          branches: refreshSession.branches,
          managedBranches,
        } as RefreshTokenPayloadDto,
      );

    return {
      accessToken,
      refreshToken,
    };
  }

  // TODO: its'not completed yet, we also need to revoke the refresh token in database
  async logout(tokenId: string): Promise<void> {
    await this.refreshTokenService.revokeRefreshToken(tokenId);
  }

  private async createTokenPairForUser(user: AuthUser): Promise<TokenDto> {
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active');
    }

    const userWithBranches = await this.getEmployeeWithBranches(user);
    const branches = userWithBranches.employeeBranches.map(
      (eb) => eb.branch.id,
    );
    const payload: AccessTokenPayloadDto = {
      sub: user.id,
      typ: 'access',
      phone: user.phoneNumber,
      empId: user.employee?.id,
      roles: user.userRoles.map((ur) => ur.role.name),
      branches,
      managedBranches: user.managerBranches.map((mb) => mb.branchId),
    };

    const accessToken = this.jwtTokenService.generateAccessToken(payload);
    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        ...payload,
        typ: 'refresh',
      } as RefreshTokenPayloadDto);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async issueAuthSessionForEmployee(
    employee: DevAuthEmployee,
    context?: {
      source?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<AuthSessionResponseDto> {
    if (!employee.user) {
      throw new ForbiddenException('EMPLOYEE_INACTIVE');
    }

    const roleNames = employee.user.userRoles.map((ur) => ur.role.name);
    const branchIds = employee.employeeBranches.map((eb) => eb.branch.id);
    const managedBranchIds = employee.user.managerBranches.map(
      (mb) => mb.branchId,
    );
    const permissions = employee.user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.subject}`,
      ),
    );

    const accessPayload: AccessTokenPayloadDto = {
      sub: employee.user.id,
      typ: 'access',
      phone: employee.user.phoneNumber,
      empId: employee.id,
      roles: roleNames,
      branches: branchIds,
      managedBranches: managedBranchIds,
    };

    const accessToken = this.jwtTokenService.generateAccessToken(accessPayload);
    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken(
        {
          ...accessPayload,
          typ: 'refresh',
        } as RefreshTokenPayloadDto,
        context,
      );

    const accessTokenExpiresIn = Math.floor(
      this.jwtTokenService.parseExpirationTime(
        this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION'),
      ) / 1000,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      user: {
        id: String(employee.id),
        fullName: employee.fullName,
        avatarUrl: employee.avatar ?? employee.user.avatarUrl ?? null,
        roles: roleNames,
        permissions,
        branchIds: branchIds.map((branchId) => String(branchId)),
      },
    };
  }

  private async findDevLoginEmployee(
    devLoginDto: DevLoginDto,
  ): Promise<DevAuthEmployee | null> {
    if (devLoginDto.employeeId) {
      const employeeId = Number(devLoginDto.employeeId);

      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        throw new BadRequestException('INVALID_DEV_LOGIN_IDENTIFIER');
      }

      return this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: devAuthEmployeeInclude,
      });
    }

    if (devLoginDto.email) {
      return this.prisma.employee.findFirst({
        where: { email: devLoginDto.email },
        include: devAuthEmployeeInclude,
      });
    }

    if (devLoginDto.phone) {
      return this.prisma.employee.findUnique({
        where: { phoneNumber: devLoginDto.phone },
        include: devAuthEmployeeInclude,
      });
    }

    throw new BadRequestException('INVALID_DEV_LOGIN_IDENTIFIER');
  }

  private assertDevAuthEnabled(): void {
    if (
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('AUTH_DEV_MODE') !== 'true' ||
      !this.configService.get<string>('AUTH_DEV_SECRET')
    ) {
      throw new ForbiddenException('DEV_AUTH_DISABLED');
    }
  }

  private assertValidDevAuthSecret(devAuthSecret: string | undefined): void {
    const configuredSecret = this.configService.get<string>('AUTH_DEV_SECRET');

    if (!devAuthSecret || !configuredSecret) {
      throw new UnauthorizedException('INVALID_DEV_AUTH_SECRET');
    }

    const provided = Buffer.from(devAuthSecret);
    const expected = Buffer.from(configuredSecret);

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException('INVALID_DEV_AUTH_SECRET');
    }
  }

  private async getEmployeeWithBranches(user: AuthUser) {
    if (!user.employee?.id) {
      throw new NotFoundException('Employee record not found for user');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: user.employee.id },
      include: {
        ...employeeWithBranchesInclude,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found for user');
    }

    return employee;
  }

  private getPhoneNumberCandidates(phoneNumber?: string): string[] {
    if (!phoneNumber) {
      return [];
    }

    const candidates = new Set<string>([phoneNumber]);
    const digits = phoneNumber.replace(/\D/g, '');

    if (digits) {
      candidates.add(digits);
      candidates.add(`+${digits}`);
    }

    if (digits.startsWith('84')) {
      candidates.add(`0${digits.slice(2)}`);
      candidates.add(`+${digits}`);
    }

    if (digits.startsWith('0')) {
      candidates.add(`84${digits.slice(1)}`);
      candidates.add(`+84${digits.slice(1)}`);
    }

    return [...candidates];
  }

  // DEPRECATED: Password reset methods - no longer needed with Zalo auth
  // async forgotPassword(email: string): Promise<void> {
  //   throw new BadRequestException(
  //     'Password reset is not available. Please use Zalo login.',
  //   );
  // }

  // async resetPassword(token: string, newPassword: string): Promise<void> {
  //   throw new BadRequestException(
  //     'Password reset is not available. Please use Zalo login.',
  //   );
  // }
}
