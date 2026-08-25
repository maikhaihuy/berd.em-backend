/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { AbilitiesService } from './abilities.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';

describe('AbilitiesService', () => {
  let prisma: Partial<PrismaService>;
  let caslAbilityFactory: { createForUser: jest.Mock };
  let service: AbilitiesService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() } as any,
    };
    caslAbilityFactory = { createForUser: jest.fn() };
    service = new AbilitiesService(
      prisma as PrismaService,
      caslAbilityFactory as unknown as CaslAbilityFactory,
    );
  });

  describe('getAbilitiesForCaller', () => {
    it("resolves against the caller's own identity, no extra query", () => {
      caslAbilityFactory.createForUser.mockReturnValue({
        rules: [
          {
            action: 'read',
            subject: 'time-logs',
            conditions: { employeeId: 5 },
          },
        ],
      });
      const caller = new AuthenticatedUserDto({
        userId: 1,
        employeeId: 5,
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { employeeId: '$self' },
          },
        ],
      });

      const result = service.getAbilitiesForCaller(caller);

      expect(caslAbilityFactory.createForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, employeeId: 5 }),
      );
      expect((prisma.user as any).findUnique).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          action: 'read',
          subject: 'time-logs',
          inverted: false,
          conditions: { employeeId: 5 },
        },
      ]);
    });

    it('omits an unresolvable rule rather than erroring (drop-rule behavior)', () => {
      caslAbilityFactory.createForUser.mockReturnValue({ rules: [] });
      const caller = new AuthenticatedUserDto({
        userId: 1,
        permissions: [
          {
            action: 'read',
            subject: 'time-logs',
            condition: { employeeId: '$self' },
          },
        ],
      });

      const result = service.getAbilitiesForCaller(caller);

      expect(result).toEqual([]);
    });
  });

  describe('getAbilitiesForUser', () => {
    it("resolves against the target user's identity, not the caller's", async () => {
      (prisma.user as any).findUnique.mockResolvedValue({
        id: 2,
        employee: { id: 8 },
        managerBranches: [],
        userRoles: [
          {
            role: {
              rolePermissions: [
                {
                  condition: { employeeId: '$self' },
                  permission: { action: 'read', subject: 'time-logs' },
                },
              ],
            },
          },
        ],
      });
      caslAbilityFactory.createForUser.mockReturnValue({
        rules: [
          {
            action: 'read',
            subject: 'time-logs',
            conditions: { employeeId: 8 },
          },
        ],
      });

      const result = await service.getAbilitiesForUser(2);

      expect(caslAbilityFactory.createForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          employeeId: 8,
          permissions: [
            {
              action: 'read',
              subject: 'time-logs',
              condition: { employeeId: '$self' },
            },
          ],
        }),
      );
      expect(result).toEqual([
        {
          action: 'read',
          subject: 'time-logs',
          inverted: false,
          conditions: { employeeId: 8 },
        },
      ]);
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      (prisma.user as any).findUnique.mockResolvedValue(null);

      await expect(service.getAbilitiesForUser(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(caslAbilityFactory.createForUser).not.toHaveBeenCalled();
    });
  });
});
