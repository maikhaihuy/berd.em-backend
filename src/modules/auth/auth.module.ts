import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (() => {
            const val = configService.get<string>(
              'JWT_ACCESS_EXPIRATION',
              '7d',
            );
            const unit = val.slice(-1);
            const amount = parseInt(val.slice(0, -1));
            switch (unit) {
              case 's':
                return amount;
              case 'm':
                return amount * 60;
              case 'h':
                return amount * 60 * 60;
              case 'd':
                return amount * 24 * 60 * 60;
              default:
                return 7 * 24 * 60 * 60; // 7 days fallback
            }
          })(),
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    LocalStrategy,
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService, RefreshTokenService],
})
export class AuthModule {}
