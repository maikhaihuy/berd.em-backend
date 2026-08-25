/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('LeaveRequestsService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: LeaveRequestsService;
  const caslAbilityFactory = new CaslAbilityFactory({
    warn: jest.fn(),
  } as unknown as LoggerService);

  const unscopedAbility = caslAbilityFactory.createForUser({
    permissions: [
      { action: 'read', subject: 'leave-requests' },
      { action: 'create', subject: 'leave-requests' },
      { action: 'cancel', subject: 'leave-requests' },
    ],
  });
  const scopedAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'read',
          subject: 'leave-requests',
          condition: { absenceEmployeeId: '$self' },
        },
        {
          action: 'create',
          subject: 'leave-requests',
          condition: { absenceEmployeeId: '$self' },
        },
        {
          action: 'cancel',
          subject: 'leave-requests',
          condition: { absenceEmployeeId: '$self' },
        },
      ],
    });

  let auditLogsService: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      assignment: { findUnique: jest.fn() } as any,
      employee: { findUnique: jest.fn() } as any,
      leaveRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
    };
    auditLogsService = { record: jest.fn() };
    service = new LeaveRequestsService(
      prisma as PrismaService,
      auditLogsService as any,
    );
  });

  describe('findAll', () => {
    it('applies no filter for an unscoped caller', async () => {
      (prisma.leaveRequest as any).findMany.mockResolvedValue([]);

      await service.findAll(unscopedAbility);

      expect((prisma.leaveRequest as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{}] } }),
      );
    });

    it('filters to the caller when a self-scoped grant is present', async () => {
      (prisma.leaveRequest as any).findMany.mockResolvedValue([]);

      await service.findAll(scopedAbility(42));

      expect((prisma.leaveRequest as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ OR: [{ absenceEmployeeId: 42 }] }] },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404s when the row exists but belongs to another employee', async () => {
      (prisma.leaveRequest as any).findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(1, scopedAbility(42)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.leaveRequest as any).findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, AND: [{ OR: [{ absenceEmployeeId: 42 }] }] },
        }),
      );
    });
  });

  describe('create', () => {
    it('ignores a spoofed absenceEmployeeId when the caller is self-scoped', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique
        .mockResolvedValueOnce({ id: 42 }) // absence employee lookup
        .mockResolvedValueOnce({ id: 7 }); // replacement employee lookup
      (prisma.leaveRequest as any).create.mockResolvedValue({
        id: 1,
        absenceEmployeeId: 42,
      });

      await service.create(
        {
          assignmentId: 5,
          absenceEmployeeId: 99,
          replacementEmployeeId: 7,
        } as any,
        1,
        scopedAbility(42),
        42,
      );

      expect((prisma.leaveRequest as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ absenceEmployeeId: 42 }),
        }),
      );
    });

    it('uses the body absenceEmployeeId for an unscoped caller (Manager filing on behalf of another employee)', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique
        .mockResolvedValueOnce({ id: 99 })
        .mockResolvedValueOnce({ id: 7 });
      (prisma.leaveRequest as any).create.mockResolvedValue({
        id: 1,
        absenceEmployeeId: 99,
      });

      await service.create(
        {
          assignmentId: 5,
          absenceEmployeeId: 99,
          replacementEmployeeId: 7,
        } as any,
        1,
        unscopedAbility,
        3,
      );

      expect((prisma.leaveRequest as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ absenceEmployeeId: 99 }),
        }),
      );
    });

    it('records an audit log entry on success', async () => {
      (prisma.assignment as any).findUnique.mockResolvedValue({ id: 5 });
      (prisma.employee as any).findUnique
        .mockResolvedValueOnce({ id: 42 })
        .mockResolvedValueOnce({ id: 7 });
      (prisma.leaveRequest as any).create.mockResolvedValue({
        id: 1,
        absenceEmployeeId: 42,
      });

      await service.create(
        {
          assignmentId: 5,
          absenceEmployeeId: 42,
          replacementEmployeeId: 7,
        } as any,
        9,
        scopedAbility(42),
        42,
      );

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 9,
          action: 'create',
          subject: 'leave-requests',
          entityId: 1,
        }),
      );
    });
  });

  describe('cancel', () => {
    it('404s (not 403) when the leave request belongs to another employee', async () => {
      (prisma.leaveRequest as any).findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(1, 99, scopedAbility(42)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.leaveRequest as any).update).not.toHaveBeenCalled();
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('records an audit log entry with the deleted row as `before`', async () => {
      (prisma.leaveRequest as any).delete.mockResolvedValue({
        id: 1,
        absenceEmployeeId: 42,
      });

      await service.remove(1, 9);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 9,
          action: 'delete',
          subject: 'leave-requests',
          entityId: 1,
          before: { id: 1, absenceEmployeeId: 42 },
        }),
      );
    });
  });
});
