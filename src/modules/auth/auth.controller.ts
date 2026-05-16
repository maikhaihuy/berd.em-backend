import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute for Zalo
  @Post('login/zalo')
  @ApiOperation({
    summary: 'Login with Zalo phone number authentication',
    description:
      'Authenticate user using Zalo access token and phone token. Only pre-registered users can log in.',
  })
  @ApiBody({ type: ZaloLoginDto })
  @HttpCode(HttpStatus.OK)
  async loginWithZalo(@Body() zaloLoginDto: ZaloLoginDto) {
    return this.authService.loginWithZalo(zaloLoginDto);
  }

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

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(@RefreshSession() refreshSession: RefreshSessionDto) {
    return await this.authService.refreshToken(refreshSession);
  }

  @UseGuards(JwtAccessGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @HttpCode(HttpStatus.OK)
  async logout(@RefreshSession() refreshSession: RefreshSessionDto) {
    await this.authService.logout(refreshSession.tokenId);
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout-device')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Logout from current device only' })
  @HttpCode(HttpStatus.OK)
  async logoutDevice(@RefreshSession() refreshSession: RefreshSessionDto) {
    await this.authService.logout(refreshSession.tokenId);
    return { message: 'Device logout successful' };
  }

  @UseGuards(JwtAccessGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Logout from all devices' })
  @HttpCode(HttpStatus.OK)
  async logoutAll(@AuthenticatedUser() user: AuthenticatedUserDto) {
    await this.refreshTokenService.revokeAllUserTokens(user.userId);
    return { message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAccessGuard)
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
