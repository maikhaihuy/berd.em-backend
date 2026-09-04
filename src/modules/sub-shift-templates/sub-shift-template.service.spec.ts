/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShiftStatus, SubShiftType } from '@prisma/client';
import { SubShiftTemplatesService } from './sub-shift-template.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'sub-shift-templates' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'sub-shift-templates',
      condition: { branchId: { in: '$managedBranches' } },
    },
  ],
  managedBranches: [1],
});

describe('SubShiftTemplatesService', () => {
  let prisma: {
    subShiftTemplate: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    masterShiftTemplate: { findUnique: jest.Mock };
  };
  let service: SubShiftTemplatesService;

  const masterTemplate = { id: 10, branchId: 1 };
  const template = {
    id: 1,
    branchId: 1,
    masterShiftTemplateId: 10,
    name: 'Morning Sub',
    type: SubShiftType.MAIN,
    startTime: new Date('2026-01-01T08:00:00Z'),
    endTime: new Date('2026-01-01T12:00:00Z'),
    maxAssignments: null,
    sortOrder: 0,
    status: ShiftStatus.ACTIVE,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      subShiftTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      masterShiftTemplate: { findUnique: jest.fn() },
    };
    service = new SubShiftTemplatesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const dto = {
      branchId: 1,
      masterShiftTemplateId: 10,
      name: 'Morning Sub',
      type: SubShiftType.MAIN,
      startTime: '2026-01-01T08:00:00Z',
      endTime: '2026-01-01T12:00:00Z',
    };

    it('creates a sub shift template', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(masterTemplate);
      prisma.subShiftTemplate.create.mockResolvedValue(template);
      const result = await service.create(dto, 1);
      expect(result.id).toBe(1);
    });

    it('throws NotFound when the master shift template does not exist', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a branch mismatch against the master shift template', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 10,
        branchId: 2,
      });
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an end time before the start time', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(masterTemplate);
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

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prisma.subShiftTemplate.findMany.mockResolvedValue([]);
      await service.findAll(managedBranchAbility);
      expect(prisma.subShiftTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              accessibleWhere(
                managedBranchAbility,
                'read',
                'sub-shift-templates',
              ),
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.subShiftTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prisma.subShiftTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(1, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.subShiftTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            AND: [
              accessibleWhere(
                managedBranchAbility,
                'read',
                'sub-shift-templates',
              ),
            ],
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { name: 'Evening Sub' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a branch mismatch when reassigning master shift template', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue(template);
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 20,
        branchId: 2,
      });
      await expect(
        service.update(1, { masterShiftTemplateId: 20 }, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a sub shift template', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue(template);
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(masterTemplate);
      prisma.subShiftTemplate.update.mockResolvedValue({
        ...template,
        name: 'Evening Sub',
      });
      const result = await service.update(1, { name: 'Evening Sub' }, 1);
      expect(result.name).toBe('Evening Sub');
    });
  });

  describe('remove', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes a sub shift template', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue(template);
      const result = await service.remove(1);
      expect(prisma.subShiftTemplate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.message).toBeDefined();
    });
  });
});
