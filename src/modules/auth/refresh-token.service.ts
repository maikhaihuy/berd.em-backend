import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from '@prisma/client';
import { JwtTokenService } from './jwt-token.service';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenPayloadDto } from './dto/refresh-token-payload.dto';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  /**
   * Generate a new refresh token for a user
   */
  async createRefreshToken(
    payload: RefreshTokenPayloadDto,
  ): Promise<{ token: string; tokenRecord: RefreshToken }> {
    const uuid = uuidv4();
    payload.jti = uuid;
    const userId = payload.sub;
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    const expiresAt = new Date(
      Date.now() + this.jwtTokenService.parseExpirationTime(expiresIn),
    );

    const refreshToken = this.jwtTokenService.generateRefreshToken(payload);
    const tokenHash = await this.jwtTokenService.hashToken(refreshToken);

    // Store the hashed token in database
    const tokenRecord = await this.prisma.refreshToken.create({
      data: {
        id: uuid,
        userId,
        hashedToken: tokenHash,
        expiresAt,
      },
    });

    return { token: refreshToken, tokenRecord };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { id: tokenId },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
      },
    });
  }

  /**
   * Get all active tokens for a user
   */
  async getUserActiveTokens(userId: number): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Rotate a refresh token (revoke old, create new)
   */
  async rotateRefreshToken(
    oldTokenId: string,
    payload: RefreshTokenPayloadDto,
  ): Promise<{ token: string; tokenRecord: RefreshToken }> {
    // Revoke the old token
    await this.revokeRefreshToken(oldTokenId);

    // Generate a new token
    return this.createRefreshToken(payload);
  }
}
