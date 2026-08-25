/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { NotFoundException } from '@nestjs/common';
import { AttendanceHistoryService } from './attendance-history.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceAction } from '@prisma/client';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('AttendanceHistoryService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: AttendanceHistoryService;
  const caslAbilityFactory = new CaslAbilityFactory({
    warn: jest.fn(),
  } as unknown as LoggerService);

  const unscopedAbility = caslAbilityFactory.createForUser({
    permissions: [
      { action: 'read', subject: 'attendance-history' },
      { action: 'create', subject: 'attendance-history' },
    ],
  });
  const scopedAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'read',
          subject: 'attendance-history',
          condition: { assignment: { is: { employeeId: '$self' } } },
        },
        {
          action: 'create',
          subject: 'attendance-history',
          condition: { assignment: { is: { employeeId: '$self' } } },
        },
      ],
    });

  beforeEach(() => {
    prisma = {
      assignment: { findFirst: jest.fn() } as any,
      attendanceHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      } as any,
    };
    service = new AttendanceHistoryService(
      prisma as PrismaService,
      { record: jest.fn() } as any,
    );
  });

  describe('create', () => {
    it("allows recording history against the caller's own assignment", async () => {
      (prisma.assignment as any).findFirst.mockResolvedValue({
        id: 5,
        employeeId: 42,
      });
      (prisma.attendanceHistory as any).create.mockResolvedValue({ id: 1 });

      await service.create(
        { assignmentId: 5, action: AttendanceAction.CHECK_IN } as any,
        1,
        scopedAbility(42),
      );

      expect((prisma.attendanceHistory as any).create).toHaveBeenCalled();
    });

    it('404s when the assignment belongs to another employee', async () => {
      (prisma.assignment as any).findFirst.mockResolvedValue({
        id: 5,
        employeeId: 999,
      });

      await expect(
        service.create(
          { assignmentId: 5, action: AttendanceAction.CHECK_IN } as any,
          1,
          scopedAbility(42),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.attendanceHistory as any).create).not.toHaveBeenCalled();
    });

    it('404s when the assignment does not exist', async () => {
      (prisma.assignment as any).findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { assignmentId: 5, action: AttendanceAction.CHECK_IN } as any,
          1,
          unscopedAbility,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('404s when the row exists but belongs to another employee', async () => {
      (prisma.attendanceHistory as any).findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(1, scopedAbility(42)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.attendanceHistory as any).findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 1,
            AND: [{ OR: [{ assignment: { is: { employeeId: 42 } } }] }],
          },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('the accessibility filter is unaffected by the employeeId query filter', async () => {
      (prisma.attendanceHistory as any).findMany.mockResolvedValue([]);

      await service.findAll({ employeeId: 99 } as any, scopedAbility(42));

      expect((prisma.attendanceHistory as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignment: { employeeId: 99 },
            AND: [{ OR: [{ assignment: { is: { employeeId: 42 } } }] }],
          }),
        }),
      );
    });

    it('applies no accessibility filter for an unscoped caller', async () => {
      (prisma.attendanceHistory as any).findMany.mockResolvedValue([]);

      await service.findAll({} as any, unscopedAbility);

      expect((prisma.attendanceHistory as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{}] } }),
      );
    });
  });
});
