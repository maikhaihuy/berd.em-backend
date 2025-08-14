import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RefreshToken } from '@prisma/client';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new refresh token for a user
   */
  async generateRefreshToken(
    userId: number,
  ): Promise<{ token: string; tokenRecord: RefreshToken }> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash the token for storage
    const tokenHash = await bcrypt.hash(token, 10);

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store the hashed token in database
    const tokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, tokenRecord };
  }

  /**
   * Validate a refresh token and return the associated user
   */
  async validateRefreshToken(token: string): Promise<RefreshToken | null> {
    // Get all non-revoked, non-expired tokens
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gte: new Date() },
      },
      include: {
        user: true,
      },
    });

    // Find the token that matches the provided token
    for (const tokenRecord of tokens) {
      if (await bcrypt.compare(token, tokenRecord.tokenHash)) {
        return tokenRecord;
      }
    }

    return null;
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Clean up expired tokens (can be called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });

    return result.count;
  }

  /**
   * Get all active tokens for a user
   */
  async getUserActiveTokens(userId: number): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
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
    userId: number,
  ): Promise<{ token: string; tokenRecord: RefreshToken }> {
    // Revoke the old token
    await this.revokeRefreshToken(oldTokenId);

    // Generate a new token
    return this.generateRefreshToken(userId);
  }
}
