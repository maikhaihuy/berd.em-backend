/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('AvailabilityService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: AvailabilityService;
  const caslAbilityFactory = new CaslAbilityFactory({
    warn: jest.fn(),
  } as unknown as LoggerService);

  const unscopedAbility = caslAbilityFactory.createForUser({
    permissions: [{ action: 'read', subject: 'availability' }],
  });
  const scopedAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'read',
          subject: 'availability',
          condition: { employeeId: '$self' },
        },
      ],
    });
  const managerAbility = (managedBranches: number[]) =>
    caslAbilityFactory.createForUser({
      managedBranches,
      permissions: [
        {
          action: 'read',
          subject: 'availability',
          condition: {
            subShift: {
              is: {
                masterShift: {
                  is: { branchId: { in: '$managedBranches' } },
                },
              },
            },
          },
        },
      ],
    });
  const deleteAbility = (canDelete: boolean, employeeId = 42) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: canDelete
        ? [{ action: 'delete', subject: 'availability' }]
        : [
            {
              action: 'delete',
              subject: 'availability',
              condition: { employeeId: '$self' },
            },
          ],
    });

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() } as any,
      availability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      } as any,
    };
    (prisma.user as any).findUnique.mockResolvedValue({
      id: 1,
      employee: { id: 42 },
    });
    service = new AvailabilityService(
      prisma as PrismaService,
      { record: jest.fn() } as any,
    );
  });

  it('findAll merges a resolved condition into the where clause', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, scopedAbility(42));

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ OR: [{ employeeId: 42 }] }],
        }),
      }),
    );
  });

  it('findAll is unaffected for an unscoped caller', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, unscopedAbility);

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: [{}] }),
      }),
    );
  });

  it('findAll returns rows for a manager scoped to a managed branch', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, managerAbility([1]), 1);

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subShift: expect.objectContaining({
            masterShift: { branchId: 1 },
          }),
          AND: [
            {
              OR: [
                {
                  subShift: {
                    is: {
                      masterShift: { is: { branchId: { in: [1] } } },
                    },
                  },
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('findAll excludes rows for a branch the manager does not manage', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, managerAbility([]), 2);

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                {
                  subShift: {
                    is: { masterShift: { is: { branchId: { in: [] } } } },
                  },
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('findAll narrows by subShiftId when provided', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, unscopedAbility, undefined, 118);

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subShiftId: 118 }),
      }),
    );
  });

  it('findOne merges a resolved condition into the where clause', async () => {
    (prisma.availability as any).findFirst.mockResolvedValue({
      id: 1,
      employeeId: 42,
    });

    await service.findOne(1, scopedAbility(42));

    expect((prisma.availability as any).findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, AND: [{ OR: [{ employeeId: 42 }] }] },
      }),
    );
  });

  describe('remove', () => {
    const existingRow = { id: 7, employeeId: 42, subShiftId: 1 };

    it('denies a non-owning caller with NotFoundException', async () => {
      (prisma.availability as any).findUnique.mockResolvedValue(existingRow);

      await expect(
        service.remove(7, 99, deleteAbility(false, 1)),
      ).rejects.toThrow(NotFoundException);
      expect((prisma.availability as any).delete).not.toHaveBeenCalled();
    });

    it('allows the owning employee to delete their own row', async () => {
      (prisma.availability as any).findUnique.mockResolvedValue(existingRow);
      (prisma.availability as any).delete.mockResolvedValue(existingRow);

      const result = await service.remove(7, 42, deleteAbility(false, 42));

      expect(result).toEqual({ message: 'Availability deleted successfully' });
      expect((prisma.availability as any).delete).toHaveBeenCalledWith({
        where: { id: 7 },
      });
    });

    it('allows an unconditioned caller (e.g. Admin) to delete any row', async () => {
      (prisma.availability as any).findUnique.mockResolvedValue(existingRow);
      (prisma.availability as any).delete.mockResolvedValue(existingRow);

      const result = await service.remove(7, 5, deleteAbility(true, 1));

      expect(result).toEqual({ message: 'Availability deleted successfully' });
      expect((prisma.availability as any).delete).toHaveBeenCalledWith({
        where: { id: 7 },
      });
    });

    it('throws NotFoundException when the row does not exist', async () => {
      (prisma.availability as any).findUnique.mockResolvedValue(null);

      await expect(
        service.remove(999, 42, deleteAbility(false, 42)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
