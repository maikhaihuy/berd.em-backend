/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UnauthorizedException } from '@nestjs/common';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PasswordService } from '@common/services/password.service';

describe('PasswordResetTokenService', () => {
  let prisma: {
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    user: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordService: {
    hash: jest.Mock;
    compare: jest.Mock;
    hashRandom: jest.Mock;
  };
  let service: PasswordResetTokenService;

  beforeEach(() => {
    prisma = {
      passwordResetToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn().mockReturnValue('token-delete-op'),
      },
      user: { update: jest.fn().mockReturnValue('user-update-op') },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-new-password'),
      compare: jest.fn(),
      hashRandom: jest.fn().mockResolvedValue({
        hashToken: 'hashed-raw-token',
        resetToken: 'raw-token',
      }),
    };
    service = new PasswordResetTokenService(
      prisma as unknown as PrismaService,
      passwordService as unknown as PasswordService,
    );
  });

  describe('issueForUser', () => {
    it('deletes existing unexpired tokens and creates a new one', async () => {
      const result = await service.issueForUser(1);

      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1 }),
        }),
      );
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            hashToken: 'hashed-raw-token',
          }),
        }),
      );
      expect(result.token).toBe('raw-token');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('consume', () => {
    it('rejects when no unexpired token matches the submitted value', async () => {
      prisma.passwordResetToken.findMany.mockResolvedValue([
        { id: 'a', userId: 1, hashToken: 'hash-a' },
      ]);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.consume('wrong-token', 'newPassword123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('matches the specific submitted token, not just any unexpired one', async () => {
      // Regression test: the original implementation used an unscoped
      // findFirst({ expiresAt: { gt: now } }) that matched an arbitrary
      // unexpired token instead of the one actually submitted.
      prisma.passwordResetToken.findMany.mockResolvedValue([
        { id: 'a', userId: 1, hashToken: 'hash-a' },
        { id: 'b', userId: 2, hashToken: 'hash-b' },
      ]);
      passwordService.compare.mockImplementation(
        (token: string, hash: string) =>
          Promise.resolve(token === 'right-token' && hash === 'hash-b'),
      );

      await service.consume('right-token', 'newPassword123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 2 } }),
      );
      expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b' } }),
      );
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'user-update-op',
        'token-delete-op',
      ]);
    });

    it('updates the matched user password and deletes the token', async () => {
      prisma.passwordResetToken.findMany.mockResolvedValue([
        { id: 'a', userId: 1, hashToken: 'hash-a' },
      ]);
      passwordService.compare.mockResolvedValue(true);

      await service.consume('raw-token', 'newPassword123');

      expect(passwordService.hash).toHaveBeenCalledWith('newPassword123');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { password: 'hashed-new-password' },
        }),
      );
      expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a' } }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
