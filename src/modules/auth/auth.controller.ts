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
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '@common/guards/jwt-refresh.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';

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
  login(@Body() login: LoginDto, @Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.authService.login(req.user);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = req.user as RefreshTokenPayload;
    return await this.authService.refreshToken(user, user.tokenId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    await this.authService.logout(req.user.id);
    return { message: 'Logout successful' };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('logout-device')
  @ApiBearerAuth('jwt-refresh')
  @ApiOperation({ summary: 'Logout from current device only' })
  @HttpCode(HttpStatus.OK)
  async logoutDevice(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = req.user as RefreshTokenPayload;
    await this.authService.logout(user.id, user.tokenId);
    return { message: 'Device logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @ApiOperation({ summary: 'Logout from all devices' })
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    await this.refreshTokenService.revokeAllUserTokens(req.user.id);
    return { message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('active-sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@Request() req) {
    const tokens = await this.refreshTokenService.getUserActiveTokens(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      req.user.id,
    );
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
