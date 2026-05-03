import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { UsersModule } from '../users/users.module';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtTokenService } from './jwt-token.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { PasswordService } from '../../common/services/password.service';
import { ZaloAuthService } from './zalo-auth.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    ConfigModule,
    ThrottlerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    JwtTokenService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    ZaloAuthService,
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
