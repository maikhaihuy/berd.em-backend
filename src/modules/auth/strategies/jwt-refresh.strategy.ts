import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshSessionDto } from '../dto/refresh-session.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RefreshTokenPayloadDto } from '../dto/refresh-token-payload.dto';
interface RefreshTokenRequest {
  refresh_token: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      ignoreExpiration: true, // We'll handle expiration manually
    } as StrategyOptionsWithRequest);
  }

  async validate(
    req: Request,
    payload: RefreshTokenPayloadDto,
  ): Promise<RefreshSessionDto> {
    const refreshToken = (req.body as RefreshTokenRequest)?.refresh_token;

    // Ensure refresh token is present in the request body
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Access Denied');
    }

    // Validate the refresh token using the service
    // Get user with active tokens
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: true,
        refreshTokens: {
          where: {
            expiresAt: { gte: new Date() },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Access Denied');
    }

    // Find matching token
    let validTokenRecord: (typeof user.refreshTokens)[0] | null = null;
    for (const tokenRecord of user.refreshTokens) {
      const isValid = await bcrypt.compare(
        refreshToken,
        tokenRecord.hashedToken,
      );
      if (isValid) {
        validTokenRecord = tokenRecord;
        break;
      }
    }

    if (!validTokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return new RefreshSessionDto({
      id: user.id,
      username: user.username,
      roles: user.roles.map((role) => role.name),
      tokenId: validTokenRecord.id,
    });
  }
}
