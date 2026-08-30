import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { UsersModule } from '../users/user.module';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtTokenService } from './jwt-token.service';
import { PasswordService } from '../../common/services/password.service';
import { ZaloAuthService } from './zalo-auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { PasswordResetTokenModule } from './password-reset-token.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    ConfigModule,
    PasswordResetTokenModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    JwtTokenService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    ZaloAuthService,
    PasswordService,
  ],
  exports: [
    AuthService,
    RefreshTokenService,
    JwtTokenService,
    PasswordService,
    ZaloAuthService,
  ],
})
export class AuthModule {}
