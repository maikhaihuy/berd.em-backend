/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ShiftStatus, SubShiftType, TaskType } from '@prisma/client';
import { MasterShiftsService } from './master-shift.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'master-shifts' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'master-shifts',
      condition: { branchId: { in: '$managedBranches' } },
    },
  ],
  managedBranches: [1],
});

const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
  code: 'P2002',
  clientVersion: 'test',
});

describe('MasterShiftsService', () => {
  let tx: {
    masterShift: { create: jest.Mock; findUnique: jest.Mock };
    subShift: { create: jest.Mock };
    task: { create: jest.Mock };
  };
  let prisma: {
    masterShift: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    masterShiftTemplate: { findUnique: jest.Mock };
    branch: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: MasterShiftsService;

  const shift = {
    id: 1,
    branchId: 1,
    masterShiftTemplateId: null,
    workDate: new Date('2026-01-01'),
    title: 'Morning',
    startTime: new Date('2026-01-01T08:00:00Z'),
    endTime: new Date('2026-01-01T17:00:00Z'),
    status: ShiftStatus.ACTIVE,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    tx = {
      masterShift: { create: jest.fn(), findUnique: jest.fn() },
      subShift: { create: jest.fn() },
      task: { create: jest.fn() },
    };
    prisma = {
      masterShift: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      masterShiftTemplate: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new MasterShiftsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const dto = {
      branchId: 1,
      workDate: '2026-01-01',
      title: 'Morning',
      startTime: '2026-01-01T08:00:00Z',
      endTime: '2026-01-01T17:00:00Z',
    };

    it('creates a master shift', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 1 });
      prisma.masterShift.create.mockResolvedValue(shift);
      const result = await service.create(dto, 1);
      expect(result.id).toBe(1);
    });

    it('throws NotFound when the branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an end time before the start time', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.create(
          {
            ...dto,
            startTime: '2026-01-01T17:00:00Z',
            endTime: '2026-01-01T08:00:00Z',
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate branch+date+title (P2002 -> 400)', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 1 });
      prisma.masterShift.create.mockRejectedValue(p2002);
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('validates the template branch instead of a bare branch when a template is given', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 5,
        branchId: 2,
      });
      await expect(
        service.create({ ...dto, masterShiftTemplateId: 5 }, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.branch.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('generateFromTemplate', () => {
    it('creates the master shift, its sub shifts, and shared + dedicated tasks', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 5,
        branchId: 1,
        name: 'Standard Day',
        startTime: new Date('1970-01-01T08:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
        subShiftTemplates: [
          {
            id: 20,
            name: 'Morning Sub',
            type: SubShiftType.MAIN,
            startTime: new Date('1970-01-01T08:00:00Z'),
            endTime: new Date('1970-01-01T12:00:00Z'),
            maxAssignments: 3,
          },
        ],
        taskTemplates: [
          {
            id: 30,
            type: TaskType.SHARED_MANDATORY,
            subShiftTemplateId: null,
            title: 'Open shop',
            description: null,
            sortOrder: 0,
            note: null,
          },
          {
            id: 31,
            type: TaskType.DEDICATED,
            subShiftTemplateId: 20,
            title: 'Clean counter',
            description: null,
            sortOrder: 1,
            note: null,
          },
        ],
      });
      tx.masterShift.create.mockResolvedValue({ id: 100 });
      tx.subShift.create.mockResolvedValue({ id: 200, subShiftTemplateId: 20 });
      tx.masterShift.findUnique.mockResolvedValue(shift);

      const result = await service.generateFromTemplate(5, '2026-01-01', 1);

      expect(result.id).toBe(1);
      expect(tx.masterShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            branchId: 1,
            masterShiftTemplateId: 5,
          }),
        }),
      );
      expect(tx.subShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            masterShiftId: 100,
            subShiftTemplateId: 20,
          }),
        }),
      );
      // Shared task attaches to the master shift, not a sub shift.
      expect(tx.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            masterShiftId: 100,
            subShiftId: undefined,
            type: TaskType.SHARED_MANDATORY,
          }),
        }),
      );
      // Dedicated task attaches to the matching sub shift, not the master shift.
      expect(tx.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            masterShiftId: undefined,
            subShiftId: 200,
            type: TaskType.DEDICATED,
          }),
        }),
      );
    });

    it('throws NotFound when the template does not exist', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.generateFromTemplate(999, '2026-01-01', 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prisma.masterShift.findMany.mockResolvedValue([]);
      await service.findAll(managedBranchAbility);
      expect(prisma.masterShift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              accessibleWhere(managedBranchAbility, 'read', 'master-shifts'),
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the master shift does not exist', async () => {
      prisma.masterShift.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prisma.masterShift.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(1, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterShift.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            AND: [
              accessibleWhere(managedBranchAbility, 'read', 'master-shifts'),
            ],
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the master shift does not exist', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { title: 'Evening' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when reassigning to a missing branch', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(shift);
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.update(1, { branchId: 999 }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates a master shift', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(shift);
      prisma.masterShift.update.mockResolvedValue({
        ...shift,
        title: 'Evening',
      });
      const result = await service.update(1, { title: 'Evening' }, 1);
      expect(result.title).toBe('Evening');
    });
  });

  describe('remove', () => {
    it('throws NotFound when the master shift does not exist', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes a master shift', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(shift);
      const result = await service.remove(1);
      expect(prisma.masterShift.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.message).toBeDefined();
    });
  });
});
