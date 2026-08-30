import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Headers,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { Public } from '@common/decorators/public.decorator';
import { SkipPermissions } from '@common/decorators/skip-permissions.decorator';
import { RefreshSession } from './decorators/refresh-session.decorator';
import { AuthenticatedUser } from './decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { Throttle } from '@nestjs/throttler';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { DevLoginDto } from './dto/dev-login.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LinkZaloDto } from './dto/link-zalo.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute for Zalo
  @Post('login/zalo')
  @ApiOperation({
    summary: 'Login with Zalo Mini App authentication',
    description:
      'Authenticate user using a Zalo access token verified by the backend. Phone token is required only for first-time account linking.',
  })
  @ApiBody({ type: ZaloLoginDto })
  @HttpCode(HttpStatus.OK)
  async loginWithZalo(@Body() zaloLoginDto: ZaloLoginDto) {
    return this.authService.loginWithZalo(zaloLoginDto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('dev/login')
  @ApiOperation({
    summary: 'Development-only employee login',
    description:
      'Login as an existing employee for local/frontend development. Disabled unless AUTH_DEV_MODE=true outside production.',
  })
  @ApiBody({ type: DevLoginDto })
  @ApiResponse({ status: 200, type: AuthSessionResponseDto })
  @HttpCode(HttpStatus.OK)
  async loginWithDev(
    @Body() devLoginDto: DevLoginDto,
    @Headers('x-dev-auth-secret') devAuthSecret: string | undefined,
    @Req() req: Request,
  ): Promise<AuthSessionResponseDto> {
    const userAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'];

    return await this.authService.loginWithDev(devLoginDto, devAuthSecret, {
      userAgent,
      ipAddress: req.ip,
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @HttpCode(HttpStatus.OK)
  login(
    @Body() login: LoginDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ) {
    return this.authService.login(user);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(@RefreshSession() refreshSession: RefreshSessionDto) {
    return await this.authService.refreshToken(refreshSession);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @HttpCode(HttpStatus.OK)
  async logout(@RefreshSession() refreshSession: RefreshSessionDto) {
    await this.authService.logout(refreshSession.tokenId);
    return { message: 'Logout successful' };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('logout-device')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Logout from current device only' })
  @HttpCode(HttpStatus.OK)
  async logoutDevice(@RefreshSession() refreshSession: RefreshSessionDto) {
    await this.authService.logout(refreshSession.tokenId);
    return { message: 'Device logout successful' };
  }

  @SkipPermissions()
  @Post('logout-all')
  @ApiOperation({ summary: 'Logout from all devices' })
  @HttpCode(HttpStatus.OK)
  async logoutAll(@AuthenticatedUser() user: AuthenticatedUserDto) {
    await this.refreshTokenService.revokeAllUserTokens(user.userId);
    return { message: 'Logged out from all devices' };
  }

  @SkipPermissions()
  @Get('active-sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@AuthenticatedUser() user: AuthenticatedUserDto) {
    const tokens = await this.refreshTokenService.getUserActiveTokens(
      user.userId,
    );
    return {
      activeSessions: tokens.map((token) => ({
        id: token.id,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
      })),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request a password reset token',
    description:
      'Always responds 200 OK regardless of whether the username matches an account, so the response never reveals account existence.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.username);
    return { message: 'If the account exists, a reset token was issued.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @Post('reset-password')
  @ApiOperation({ summary: 'Complete a password reset with a valid token' })
  @ApiBody({ type: ResetPasswordDto })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
    return { message: 'Password reset successful.' };
  }

  @SkipPermissions()
  @Post('link/zalo')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Link a Zalo identity to the caller's own account",
    description:
      'Authenticated, self-service linking — independent of POST /auth/login/zalo. Does not require the caller to have logged in via Zalo.',
  })
  @ApiBody({ type: LinkZaloDto })
  @HttpCode(HttpStatus.OK)
  async linkZalo(
    @Body() linkZaloDto: LinkZaloDto,
    @AuthenticatedUser() user: AuthenticatedUserDto,
  ): Promise<{ message: string }> {
    await this.authService.linkZalo(user.userId, linkZaloDto.accessToken);
    return { message: 'Zalo account linked successfully.' };
  }
}
