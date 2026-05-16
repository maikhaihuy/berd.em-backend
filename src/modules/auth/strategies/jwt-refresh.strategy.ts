import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import { Request } from 'express';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RefreshTokenPayloadDto } from '../dto/refresh-token-payload.dto';
import {
  TokenExpiredException,
  InvalidTokenException,
} from '../exceptions/auth.exceptions';
import { RefreshDto } from '../dto/refresh.dto';
import { userWithRoleInclude } from '@modules/users/user.types';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  private readonly logger = new Logger(JwtRefreshStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      ignoreExpiration: true, // Let passport-jwt handle expiration
    } as StrategyOptionsWithRequest);
  }

  async validate(
    req: Request,
    payload: RefreshTokenPayloadDto,
    done: (error: Error | null, user?: any, info?: any) => void,
  ): Promise<RefreshSessionDto | void> {
    try {
      const refreshToken = (req.body as RefreshDto)?.refreshToken;

      if (!refreshToken || typeof refreshToken !== 'string') {
        this.logger.warn('Refresh token missing from request body');
        return done(new UnauthorizedException('Refresh token is required'));
      }

      // Clean up expired tokens for this user
      await this.cleanupExpiredTokens(payload.sub);

      // Get user with active tokens
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          ...userWithRoleInclude,
          refreshTokens: {
            where: {
              expiresAt: { gte: new Date() },
            },
          },
        },
      });

      if (!user) {
        this.logger.warn(`User not found with id: ${payload.sub}`);
        return done(new UnauthorizedException('User not found'));
      }

      // Find matching token
      const tokenRecord = await this.findValidToken(
        user.refreshTokens,
        refreshToken,
      );

      if (!tokenRecord) {
        this.logger.warn('No valid refresh token found for user');
        return done(
          new InvalidTokenException('Invalid or expired refresh token'),
        );
      }

      // Verify token expiration
      if (new Date() > tokenRecord.expiresAt) {
        this.logger.warn('Refresh token has expired');
        return done(new TokenExpiredException('Refresh token has expired'));
      }

      const session = new RefreshSessionDto({
        userId: user.id,
        phone: user.phoneNumber,
        role: user.role.name,
        tokenId: tokenRecord.id,
      });

      return done(null, session);
    } catch (error) {
      this.logger.error(
        'Error validating refresh token',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof TokenExpiredError) {
        return done(new TokenExpiredException('Refresh token has expired'));
      }

      return done(new UnauthorizedException('Authentication failed'));
    }
  }

  private async findValidToken(
    tokens: { id: string; hashedToken: string; expiresAt: Date }[],
    refreshToken: string,
  ) {
    for (const tokenRecord of tokens) {
      try {
        const isValid = await bcrypt.compare(
          refreshToken,
          tokenRecord.hashedToken,
        );
        if (isValid) {
          return tokenRecord;
        }
      } catch (error) {
        this.logger.error(
          'Error comparing tokens',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    return null;
  }

  private async cleanupExpiredTokens(userId: number): Promise<void> {
    try {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          expiresAt: { lt: new Date() },
        },
      });
    } catch (error) {
      this.logger.error(
        'Error cleaning up expired tokens',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
