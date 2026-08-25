/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('TimeTrackingService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: TimeTrackingService;
  const caslAbilityFactory = new CaslAbilityFactory(
    { warn: jest.fn() } as unknown as LoggerService,
  );

  const unscopedAbility = caslAbilityFactory.createForUser({
    permissions: [
      { action: 'read', subject: 'time-logs' },
      { action: 'create', subject: 'time-logs' },
    ],
  });
  const scopedAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'read',
          subject: 'time-logs',
          condition: { employeeId: '$self' },
        },
        {
          action: 'create',
          subject: 'time-logs',
          condition: { employeeId: '$self' },
        },
      ],
    });

  let auditLogsService: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      assignment: { findUnique: jest.fn() } as any,
      employee: { findUnique: jest.fn() } as any,
      timeLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      } as any,
    };
    auditLogsService = { record: jest.fn() };
    service = new TimeTrackingService(
      prisma as PrismaService,
      auditLogsService as any,
    );
  });

  describe('findAll', () => {
    it('applies no filter for an unscoped caller', async () => {
      (prisma.timeLog as any).findMany.mockResolvedValue([]);

      await service.findAll(unscopedAbility);

      expect((prisma.timeLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{}] } }),
      );
    });

    it('filters to the caller when a self-scoped grant is present', async () => {
      (prisma.timeLog as any).findMany.mockResolvedValue([]);

      await service.findAll(scopedAbility(42));

      expect((prisma.timeLog as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ OR: [{ employeeId: 42 }] }] },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404s when the row exists but belongs to another employee', async () => {
      (prisma.timeLog as any).findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(1, scopedAbility(42)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.timeLog as any).findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, AND: [{ OR: [{ employeeId: 42 }] }] },
        }),
      );
    });

    it('returns the row when it belongs to the caller', async () => {
      (prisma.timeLog as any).findFirst.mockResolvedValue({
        id: 1,
        employeeId: 42,
      });

      await expect(service.findOne(1, scopedAbility(42))).resolves.toEqual(
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  describe('create', () => {
    it('ignores a spoofed employeeId when the caller is self-scoped', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique.mockResolvedValue({ id: 42 });
      (prisma.timeLog as any).create.mockResolvedValue({
        id: 1,
        employeeId: 42,
      });

      await service.create(
        {
          assignmentId: 5,
          employeeId: 99,
          multiplier: 1,
        } as any,
        1,
        scopedAbility(42),
        42,
      );

      expect((prisma.employee as any).findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
      });
      expect((prisma.timeLog as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeId: 42 }),
        }),
      );
    });

    it('uses the body employeeId for an unscoped caller (e.g. Manager creating on behalf of another employee)', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique.mockResolvedValue({ id: 99 });
      (prisma.timeLog as any).create.mockResolvedValue({
        id: 1,
        employeeId: 99,
      });

      await service.create(
        {
          assignmentId: 5,
          employeeId: 99,
          multiplier: 1,
        } as any,
        1,
        unscopedAbility,
        7, // Manager's own employeeId, distinct from the target employee
      );

      expect((prisma.timeLog as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeId: 99 }),
        }),
      );
    });

    it('records an audit log entry on success', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique.mockResolvedValue({ id: 42 });
      (prisma.timeLog as any).create.mockResolvedValue({
        id: 1,
        employeeId: 42,
      });

      await service.create(
        { assignmentId: 5, employeeId: 42, multiplier: 1 } as any,
        7,
        scopedAbility(42),
        42,
      );

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 7,
          action: 'create',
          subject: 'time-logs',
          entityId: 1,
        }),
      );
    });

    it('does not record an audit log entry when the write is rejected', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { assignmentId: 5, employeeId: 42, multiplier: 1 } as any,
          7,
          scopedAbility(42),
          42,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('records an audit log entry with the deleted row as `before`', async () => {
      (prisma.timeLog as any).delete.mockResolvedValue({
        id: 1,
        employeeId: 42,
      });

      await service.remove(1, 7);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 7,
          action: 'delete',
          subject: 'time-logs',
          entityId: 1,
          before: { id: 1, employeeId: 42 },
        }),
      );
    });
  });
});
