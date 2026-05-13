import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
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
import {
  userWithEmployeeInclude,
  userWithRoleInclude,
} from '@modules/users/user.types';
import { employeeWithBranchesInclude } from '@modules/employees/employee.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordService: PasswordService,
    private readonly zaloAuthService: ZaloAuthService,
  ) {}

  /**
   * Zalo Phone Number Login
   * Only pre-registered employees can log in using their Zalo phone number
   */
  async loginWithZalo(zaloLoginDto: ZaloLoginDto): Promise<TokenDto> {
    const { accessToken, phoneToken } = zaloLoginDto;

    // 1. Call Zalo Graph API to decrypt phone number
    const zaloProfile = await this.zaloAuthService.getPhoneNumber(
      accessToken,
      phoneToken,
    );

    const phoneNumber = zaloProfile.phoneNumber;

    // 2. Check if the user exists in our database
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        ...userWithRoleInclude,
        ...userWithEmployeeInclude,
      },
    });

    // 3. Deny access if not pre-registered
    if (!user) {
      throw new NotFoundException(
        'Your phone number is not registered in the system. Please contact your manager to register.',
      );
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active');
    }

    // 4. Update user's Zalo ID if not already set (first time login)
    if (!user.zaloId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { zaloId: accessToken.substring(0, 50) }, // Store partial token as zaloId
      });
    }

    // 5. Fetch user's branches for token payload
    const userWithBranches = await this.prisma.employee.findUnique({
      where: { id: user.id },
      include: {
        ...employeeWithBranchesInclude,
      },
    });
    if (!userWithBranches) {
      throw new NotFoundException('Employee record not found for user');
    }

    // 6. Generate JWT tokens
    const accessTokenPayload: AccessTokenPayloadDto = {
      sub: user.id,
      phone: user.phoneNumber, // Using phone number as email for compatibility
      empId: user.employee?.id || undefined,
      role: user.role.name,
      branches: userWithBranches.employeeBranches.map((eb) => eb.branch.id),
    };

    const jwtAccessToken =
      this.jwtTokenService.generateAccessToken(accessTokenPayload);

    // 7. Generate and save refresh token
    const refreshTokenPayload: RefreshTokenPayloadDto = {
      sub: user.id,
      empId: user.employee?.id || undefined,
      phone: user.phoneNumber,
      role: user.role.name,
      branches: userWithBranches.employeeBranches.map((eb) => eb.branch.id),
    };

    const { token: jwtRefreshToken } =
      await this.refreshTokenService.createRefreshToken(refreshTokenPayload);

    // 8. Return tokens with user info
    return {
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
      // user: {
      //   id: user.id,
      //   phoneNumber: user.phoneNumber,
      //   fullName: user.fullName,
      //   role: user.role.name,
      //   roleId: user.roleId,
      // },
    };
  }

  async login(user: AuthenticatedUserDto): Promise<TokenDto> {
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.userId,
      phone: user.phone,
      empId: user.employeeId,
      role: user.role,
      branches: user.branches,
    });

    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        sub: user.userId,
        phone: user.phone,
        empId: user.employeeId,
        role: user.role,
        branches: user.branches,
      });

    return {
      accessToken,
      refreshToken,
    };
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
      include: {
        ...userWithRoleInclude,
        ...userWithEmployeeInclude,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userWithBranches = await this.prisma.employee.findUnique({
      where: { id: user.id },
      include: {
        ...employeeWithBranchesInclude,
      },
    });
    if (!userWithBranches) {
      throw new NotFoundException('Employee record not found for user');
    }

    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      phone: user.phoneNumber,
      empId: user.employee?.id || undefined,
      role: user.role.name,
      branches: userWithBranches.employeeBranches.map((eb) => eb.branch.id),
    });

    const { token: refreshToken } =
      await this.refreshTokenService.rotateRefreshToken(
        refreshSession.tokenId,
        {
          sub: user.id,
          phone: user.phoneNumber,
          empId: user.employee?.id || undefined,
          role: user.role.name,
          branches: refreshSession.branches,
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
