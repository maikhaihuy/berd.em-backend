/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { AvailabilityService } from './availability.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';

describe('AvailabilityService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: AvailabilityService;
  const caslAbilityFactory = new CaslAbilityFactory();

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

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() } as any,
      availability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      } as any,
    };
    (prisma.user as any).findUnique.mockResolvedValue({
      id: 1,
      employee: { id: 42 },
    });
    service = new AvailabilityService(prisma as PrismaService);
  });

  it('findAll merges a resolved condition into the where clause', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, 1, scopedAbility(42));

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 42,
          AND: [{ OR: [{ employeeId: 42 }] }],
        }),
      }),
    );
  });

  it('findAll is unaffected for an unscoped caller', async () => {
    (prisma.availability as any).findMany.mockResolvedValue([]);

    const from = new Date('2026-01-01');
    const to = new Date('2026-01-07');

    await service.findAll(from, to, 1, unscopedAbility);

    expect((prisma.availability as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 42, AND: [{}] }),
      }),
    );
  });

  it('findOne merges a resolved condition into the where clause', async () => {
    (prisma.availability as any).findFirst.mockResolvedValue({
      id: 1,
      employeeId: 42,
    });

    await service.findOne(1, 1, scopedAbility(42));

    expect((prisma.availability as any).findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, employeeId: 42, AND: [{ OR: [{ employeeId: 42 }] }] },
      }),
    );
  });
});
