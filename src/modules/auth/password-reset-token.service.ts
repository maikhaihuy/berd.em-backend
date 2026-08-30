import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PasswordService } from '@common/services/password.service';

@Injectable()
export class PasswordResetTokenService {
  private readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Invalidates any outstanding unexpired tokens for the user, then issues a
   * fresh one and returns its raw (unhashed) value — the only point at which
   * the raw token is ever available, since only its hash is persisted.
   */
  async issueForUser(userId: number): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId, expiresAt: { gt: new Date() } },
    });

    const { hashToken, resetToken } = await this.passwordService.hashRandom();
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId, hashToken, expiresAt },
    });

    return { token: resetToken, expiresAt };
  }

  /**
   * Matches the submitted token against every unexpired stored hash (the
   * token itself carries no userId to pre-scope the lookup by), then
   * atomically sets the new password and invalidates the matched token.
   */
  async consume(token: string, newPassword: string): Promise<void> {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { expiresAt: { gt: new Date() } },
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await this.passwordService.compare(token, candidate.hashToken)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: matched.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.delete({ where: { id: matched.id } }),
    ]);
  }
}
