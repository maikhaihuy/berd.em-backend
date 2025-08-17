import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { TokenDto } from './dto/token.dto';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { Prisma } from '@prisma/client';
import { RefreshTokenService } from './refresh-token.service';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { AccessTokenPayloadDto } from './dto/access-token-payload.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { JwtTokenService } from './jwt-token.service';
import { RefreshTokenPayloadDto } from './dto/refresh-token-payload.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthenticatedUserDto> {
    const {
      username,
      password,
      fullName,
      phoneNumber,
      email,
      address,
      dateOfBirth,
      probationStartDate,
      officialStartDate,
      roleIds,
      branchIds,
    } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }

    // Validate roles exist
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    // Validate branches exist if provided
    if (branchIds && branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
      });
      if (branches.length !== branchIds.length) {
        throw new BadRequestException('One or more branches do not exist');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Use transaction to create both User and Employee
      const result = await this.prisma.$transaction(async (tx) => {
        // Create Employee first
        const employee = await tx.employee.create({
          data: {
            fullName,
            phoneNumber,
            email,
            address,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            probationStartDate: probationStartDate
              ? new Date(probationStartDate)
              : undefined,
            officialStartDate: officialStartDate
              ? new Date(officialStartDate)
              : undefined,
            createdBy: 1, // TODO: Get from current user context
            updatedBy: 1, // TODO: Get from current user context
          },
        });

        // Create User with reference to Employee
        const user = await tx.user.create({
          data: {
            username,
            password: hashedPassword,
            status: 'ACTIVE',
            employeeId: employee.id,
          },
        });

        // Connect roles directly to user (many-to-many)
        if (roleIds && roleIds.length > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              roles: {
                connect: roleIds.map((roleId) => ({ id: roleId })),
              },
            },
          });
        }

        // Create EmployeeBranch relationships with isPrimary field
        if (branchIds && branchIds.length > 0) {
          for (let i = 0; i < branchIds.length; i++) {
            await tx.employeeBranch.create({
              data: {
                employeeId: employee.id,
                branchId: branchIds[i],
                isPrimary: i === 0, // First branch is primary
              },
            });
          }
        }

        return { user, employee };
      });

      return new AuthenticatedUserDto({
        id: result.user.id,
        username: result.user.username,
        employeeId: result.user.employeeId || 0,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
  }

  async login(user: AuthenticatedUserDto): Promise<TokenDto> {
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: user.id,
      email: user.username,
      roles: user.roles,
    } as AccessTokenPayloadDto);

    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        sub: user.id,
        email: user.username,
        roles: user.roles,
      } as RefreshTokenPayloadDto);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshSession: RefreshSessionDto): Promise<TokenDto> {
    const accessToken = this.jwtTokenService.generateAccessToken({
      sub: refreshSession.id,
      email: refreshSession.username,
      roles: refreshSession.roles,
    } as AccessTokenPayloadDto);
    const { token: refreshToken } =
      await this.refreshTokenService.rotateRefreshToken(
        refreshSession.tokenId,
        {
          sub: refreshSession.id,
          email: refreshSession.username,
          roles: refreshSession.roles,
        } as RefreshTokenPayloadDto,
      );

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: number, tokenId?: string) {
    if (tokenId) {
      // Revoke specific token
      await this.refreshTokenService.revokeRefreshToken(tokenId);
    } else {
      // Revoke all tokens for user
      await this.refreshTokenService.revokeAllUserTokens(userId);
    }
  }

  async forgotPassword(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      // Không báo lỗi để tránh lộ thông tin email có tồn tại hay không
      return {
        message:
          'Nếu email tồn tại, bạn sẽ nhận được một link để đặt lại mật khẩu.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashToken = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Delete any existing reset tokens for this user
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        hashToken,
        expiresAt,
      },
    });

    // TODO: Gửi email chứa `resetToken` cho người dùng
    console.log(`Reset Token (gửi cho user): ${resetToken}`);

    return { message: 'Link đặt lại mật khẩu đã được gửi đến email của bạn.' };
  }

  async resetPassword(token: string, newPass: string) {
    // Find valid reset token
    const resetTokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!resetTokenRecord) {
      throw new ForbiddenException('Token không hợp lệ hoặc đã hết hạn.');
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(
      token,
      resetTokenRecord.hashToken,
    );
    if (!isValidToken) {
      throw new ForbiddenException('Token không hợp lệ hoặc đã hết hạn.');
    }

    const password = await bcrypt.hash(newPass, 10);

    // Update user password and delete reset token
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetTokenRecord.userId },
        data: { password },
      });

      await tx.passwordResetToken.delete({
        where: { id: resetTokenRecord.id },
      });
    });

    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }
}
