import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicUserDto } from '../dto/public-user.dto';
import { RefreshTokenService } from '../refresh-token.service';

interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenPayload extends PublicUserDto {
  tokenId: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
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
    payload: { sub: number },
  ): Promise<RefreshTokenPayload> {
    const refreshToken = (req.body as RefreshTokenRequest)?.refresh_token;

    // Ensure refresh token is present in the request body
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Access Denied');
    }

    // Validate the refresh token using the service
    const result = await this.refreshTokenService.validateRefreshToken(
      refreshToken,
      payload.sub,
    );

    if (!result) {
      throw new UnauthorizedException('Access Denied');
    }

    const { user, tokenRecord } = result;

    const userDto = new PublicUserDto(user);
    return {
      ...userDto,
      tokenId: tokenRecord.id,
    };
  }
}
