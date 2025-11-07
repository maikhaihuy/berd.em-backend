import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayloadDto } from './dto/access-token-payload.dto';
import { RefreshTokenPayloadDto } from './dto/refresh-token-payload.dto';
import * as bcrypt from 'bcrypt';
import {
  JWT_ACCESS_EXPIRATION,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_EXPIRATION,
  JWT_REFRESH_SECRET,
} from '@common/constants/jwt.constant';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: AccessTokenPayloadDto) {
    const secret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      JWT_ACCESS_SECRET,
    );
    const expiresInStr = this.configService.get<string>(
      'JWT_ACCESS_EXPIRATION',
      JWT_ACCESS_EXPIRATION,
    );
    const expiresIn = this.parseExpirationSeconds(expiresInStr);
    return this.jwtService.sign(payload, {
      secret,
      expiresIn,
    });
  }

  generateRefreshToken(payload: RefreshTokenPayloadDto) {
    if (!payload.jti) throw new Error('JTI is required');
    const secret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      JWT_REFRESH_SECRET,
    );
    const expiresInStr = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      JWT_REFRESH_EXPIRATION,
    );
    const expiresIn = this.parseExpirationSeconds(expiresInStr);
    // Sign the refresh token
    return this.jwtService.sign(payload, {
      secret,
      expiresIn,
    });
  }

  async hashToken(token: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(token, saltRounds);
  }

  parseExpirationTime(expiresIn: string): number {
    const timeUnit = expiresIn.slice(-1);
    const timeValue = parseInt(expiresIn.slice(0, -1));

    switch (timeUnit) {
      case 's':
        return timeValue * 1000;
      case 'm':
        return timeValue * 60 * 1000;
      case 'h':
        return timeValue * 60 * 60 * 1000;
      case 'd':
        return timeValue * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // Default to 1 day
    }
  }

  private parseExpirationSeconds(expiresIn: string): number {
    // Convert a shorthand like 7d/24h/15m/30s to seconds
    const ms = this.parseExpirationTime(expiresIn);
    return Math.floor(ms / 1000);
  }
}
