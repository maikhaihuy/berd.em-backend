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
// Deprecated imports removed: LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto
// These are no longer used since Zalo authentication is now the primary method
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

  @SkipPermissions()
  @Post('logout')
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

  // DEPRECATED: Password reset endpoints removed
  // No longer needed with Zalo phone number authentication
}
