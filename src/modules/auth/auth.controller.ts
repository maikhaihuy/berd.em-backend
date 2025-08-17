import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { LocalAuthGuard } from '@common/guards/local-auth.guard';
import { JwtAccessGuard } from '@common/guards/jwt-access.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshSession } from './decorators/refresh-session.decorator';
import { AuthenticatedUser } from './decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from './dto/authenticated-user.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(ValidationPipe)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(ValidationPipe)
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
    await this.authService.logout(refreshSession.id);
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout-device')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Logout from current device only' })
  @HttpCode(HttpStatus.OK)
  async logoutDevice(@RefreshSession() refreshSession: RefreshSessionDto) {
    await this.authService.logout(refreshSession.id, refreshSession.tokenId);
    return { message: 'Device logout successful' };
  }

  @UseGuards(JwtAccessGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Logout from all devices' })
  @HttpCode(HttpStatus.OK)
  async logoutAll(@AuthenticatedUser() user: AuthenticatedUserDto) {
    await this.refreshTokenService.revokeAllUserTokens(user.id);
    return { message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAccessGuard)
  @Post('active-sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@AuthenticatedUser() user: AuthenticatedUserDto) {
    const tokens = await this.refreshTokenService.getUserActiveTokens(user.id);
    return {
      activeSessions: tokens.map((token) => ({
        id: token.id,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
      })),
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(ValidationPipe)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.username);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(ValidationPipe)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
