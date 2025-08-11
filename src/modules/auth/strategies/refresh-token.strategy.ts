import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  async validate(req: Request, payload: any) {
    const refreshToken = (req.body as any)?.refresh_token;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    // Ensure refresh token is present in the request body
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Access Denied');
    }

    // So sánh refresh token từ request với token đã hash trong DB
    const isRefreshTokenMatching = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenMatching) {
      throw new UnauthorizedException('Access Denied');
    }

    return { ...payload, refreshToken };
  }
}
