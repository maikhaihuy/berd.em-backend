/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import {
  AttendanceAction,
  AvailabilityStatus,
  TaskStatus,
  TaskType,
  WorkSlotStatus,
} from '@prisma/client';
import { AssignmentsService } from './assignment.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('AssignmentsService', () => {
  let prisma: Partial<PrismaService>;
  let service: AssignmentsService;
  let auditLogsService: { record: jest.Mock };
  const caslAbilityFactory = new CaslAbilityFactory(
    { warn: jest.fn() } as unknown as LoggerService,
  );
  const unscopedCheckOutAbility = caslAbilityFactory.createForUser({
    permissions: [{ action: 'check-out', subject: 'assignments' }],
  });
  const scopedCheckOutAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'check-out',
          subject: 'assignments',
          condition: { employeeId: '$self' },
        },
      ],
    });

  beforeEach(() => {
    prisma = {
      employee: { findUnique: jest.fn() } as any,
      subShift: { findUnique: jest.fn() } as any,
      availability: { findUnique: jest.fn(), update: jest.fn() } as any,
      assignment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      attendanceHistory: { create: jest.fn() } as any,
      task: { findMany: jest.fn() } as any,
      $transaction: jest.fn((callback: (prism: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    auditLogsService = { record: jest.fn() };
    service = new AssignmentsService(
      prisma as PrismaService,
      auditLogsService as any,
    );
  });

  it('creates an assignment and marks linked availability as assigned', async () => {
    (prisma.employee as any).findUnique.mockResolvedValue({ id: 1 });

    (prisma.subShift as any).findUnique.mockResolvedValue({ id: 2 });

    (prisma.availability as any).findUnique.mockResolvedValue({
      id: 3,
      employeeId: 1,
      subShiftId: 2,
    });

    (prisma.assignment as any).create.mockResolvedValue({ id: 10 });

    await expect(
      service.create({ employeeId: 1, subShiftId: 2, availabilityId: 3 }, 99),
    ).resolves.toEqual({ id: 10 });

    expect((prisma.assignment as any).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 1,
          subShiftId: 2,
          availabilityId: 3,
          status: WorkSlotStatus.SCHEDULED,
        }),
      }),
    );

    expect((prisma.availability as any).update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { status: AvailabilityStatus.ASSIGNED, updatedBy: 99 },
    });
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 99,
        action: 'create',
        subject: 'assignments',
        entityId: 10,
      }),
    );
  });

  it('blocks checkout while mandatory or dedicated tasks are pending', async () => {
    (prisma.assignment as any).findFirst.mockResolvedValue({
      id: 10,
      subShiftId: 2,
      status: WorkSlotStatus.IN_PROGRESS,
      actualStartTime: new Date('2026-05-30T08:00:00.000Z'),
      note: null,
    });

    (prisma.subShift as any).findUnique.mockResolvedValue({ masterShiftId: 1 });

    (prisma.task as any).findMany.mockResolvedValue([
      {
        id: 100,
        title: 'Open shop',
        type: TaskType.SHARED_MANDATORY,
        status: TaskStatus.PENDING,
      },
      {
        id: 101,
        title: 'Clean counter',
        type: TaskType.DEDICATED,
        status: TaskStatus.PENDING,
      },
    ]);

    await expect(
      service.checkOut(10, {}, 99, unscopedCheckOutAbility),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect((prisma.assignment as any).update).not.toHaveBeenCalled();
  });

  it('allows checkout with pending optional tasks and records warnings', async () => {
    const assignment = {
      id: 10,
      subShiftId: 2,
      status: WorkSlotStatus.IN_PROGRESS,
      actualStartTime: new Date('2026-05-30T08:00:00.000Z'),
      note: null,
    };

    (prisma.assignment as any).findFirst.mockResolvedValue(assignment);

    (prisma.subShift as any).findUnique.mockResolvedValue({ masterShiftId: 1 });

    (prisma.task as any).findMany.mockResolvedValue([
      {
        id: 100,
        title: 'Refill cups',
        type: TaskType.SHARED_OPTIONAL,
        status: TaskStatus.PENDING,
      },
    ]);

    (prisma.assignment as any).update.mockResolvedValue({
      ...assignment,
      status: WorkSlotStatus.COMPLETED,
    });

    const result = await service.checkOut(
      10,
      { actualEndTime: '2026-05-30T10:00:00.000Z' },
      99,
      unscopedCheckOutAbility,
    );

    expect(result.warnings).toEqual([
      { id: 100, title: 'Refill cups', type: TaskType.SHARED_OPTIONAL },
    ]);

    expect((prisma.attendanceHistory as any).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignmentId: 10,
        action: AttendanceAction.CHECK_OUT,
        detail: expect.objectContaining({
          warnings: result.warnings,
        }),
      }),
    });
  });

  it('404s (not 403) when a self-scoped caller checks out an assignment that is not their own', async () => {
    (prisma.assignment as any).findFirst.mockResolvedValue({
      id: 10,
      employeeId: 999,
      subShiftId: 2,
      status: WorkSlotStatus.IN_PROGRESS,
      actualStartTime: new Date('2026-05-30T08:00:00.000Z'),
      note: null,
    });

    await expect(
      service.checkOut(
        10,
        { actualEndTime: '2026-05-30T10:00:00.000Z' },
        99,
        scopedCheckOutAbility(42),
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect((prisma.assignment as any).update).not.toHaveBeenCalled();
  });

  it('allows a self-scoped caller to check out their own assignment', async () => {
    const assignment = {
      id: 10,
      employeeId: 42,
      subShiftId: 2,
      status: WorkSlotStatus.IN_PROGRESS,
      actualStartTime: new Date('2026-05-30T08:00:00.000Z'),
      note: null,
    };
    (prisma.assignment as any).findFirst.mockResolvedValue(assignment);
    (prisma.subShift as any).findUnique.mockResolvedValue({ masterShiftId: 1 });
    (prisma.task as any).findMany.mockResolvedValue([]);
    (prisma.assignment as any).update.mockResolvedValue({
      ...assignment,
      status: WorkSlotStatus.COMPLETED,
    });

    await expect(
      service.checkOut(
        10,
        { actualEndTime: '2026-05-30T10:00:00.000Z' },
        99,
        scopedCheckOutAbility(42),
      ),
    ).resolves.toBeDefined();
  });
});
