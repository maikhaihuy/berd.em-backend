/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShiftStatus, SubShiftType } from '@prisma/client';
import { SubShiftsService } from './sub-shift.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'sub-shifts' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'sub-shifts',
      condition: {
        masterShift: { is: { branchId: { in: '$managedBranches' } } },
      },
    },
  ],
  managedBranches: [1],
});

describe('SubShiftsService', () => {
  let prisma: {
    subShift: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    masterShift: { findUnique: jest.Mock };
    subShiftTemplate: { findUnique: jest.Mock };
  };
  let service: SubShiftsService;

  const masterShift = { id: 1, branchId: 1 };
  const subShift = {
    id: 1,
    masterShiftId: 1,
    subShiftTemplateId: null,
    title: 'Morning',
    type: SubShiftType.MAIN,
    startTime: new Date('2026-01-01T08:00:00Z'),
    endTime: new Date('2026-01-01T12:00:00Z'),
    maxAssignments: null,
    status: ShiftStatus.ACTIVE,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      subShift: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      masterShift: { findUnique: jest.fn() },
      subShiftTemplate: { findUnique: jest.fn() },
    };
    service = new SubShiftsService(prisma as unknown as PrismaService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when the sub shift does not exist', async () => {
      prisma.subShift.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prisma.subShift.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(10, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.subShift.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 10,
            AND: [accessibleWhere(managedBranchAbility, 'read', 'sub-shifts')],
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prisma.subShift.findMany.mockResolvedValue([]);

      await service.findAll(managedBranchAbility);

      expect(prisma.subShift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [accessibleWhere(managedBranchAbility, 'read', 'sub-shifts')],
          }),
        }),
      );
    });
  });

  describe('create', () => {
    const dto = {
      masterShiftId: 1,
      title: 'Morning',
      type: SubShiftType.MAIN,
      startTime: '2026-01-01T08:00:00Z',
      endTime: '2026-01-01T12:00:00Z',
    };

    it('creates a sub shift', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(masterShift);
      prisma.subShift.create.mockResolvedValue(subShift);
      const result = await service.create(dto, 1);
      expect(result.id).toBe(1);
    });

    it('throws NotFound when the master shift does not exist', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the sub shift template does not exist', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(masterShift);
      prisma.subShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, subShiftTemplateId: 5 }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a sub shift template branch mismatch', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(masterShift);
      prisma.subShiftTemplate.findUnique.mockResolvedValue({
        id: 5,
        branchId: 2,
      });
      await expect(
        service.create({ ...dto, subShiftTemplateId: 5 }, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an end time before the start time', async () => {
      prisma.masterShift.findUnique.mockResolvedValue(masterShift);
      await expect(
        service.create(
          {
            ...dto,
            startTime: '2026-01-01T12:00:00Z',
            endTime: '2026-01-01T08:00:00Z',
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFound when the sub shift does not exist', async () => {
      prisma.subShift.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { title: 'Evening' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates a sub shift', async () => {
      prisma.subShift.findUnique.mockResolvedValue(subShift);
      prisma.masterShift.findUnique.mockResolvedValue(masterShift);
      prisma.subShift.update.mockResolvedValue({
        ...subShift,
        title: 'Evening',
      });
      const result = await service.update(1, { title: 'Evening' }, 1);
      expect(result.title).toBe('Evening');
    });
  });

  describe('remove', () => {
    it('throws NotFound when the sub shift does not exist', async () => {
      prisma.subShift.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes a sub shift', async () => {
      prisma.subShift.findUnique.mockResolvedValue(subShift);
      const result = await service.remove(1);
      expect(prisma.subShift.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.message).toBeDefined();
    });
  });
});
