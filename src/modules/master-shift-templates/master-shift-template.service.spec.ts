/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ShiftStatus } from '@prisma/client';
import { MasterShiftTemplatesService } from './master-shift-template.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'master-shift-templates' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'master-shift-templates',
      condition: { branchId: { in: '$managedBranches' } },
    },
  ],
  managedBranches: [1],
});

const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
  code: 'P2002',
  clientVersion: 'test',
});

describe('MasterShiftTemplatesService', () => {
  let prisma: {
    masterShiftTemplate: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    branch: { findUnique: jest.Mock };
  };
  let service: MasterShiftTemplatesService;

  const template = {
    id: 1,
    branchId: 1,
    name: 'Morning',
    abbreviation: null,
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
    prisma = {
      masterShiftTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      branch: { findUnique: jest.fn() },
    };
    service = new MasterShiftTemplatesService(
      prisma as unknown as PrismaService,
    );
  });

  describe('create', () => {
    const dto = {
      branchId: 1,
      name: 'Morning',
      startTime: '2026-01-01T08:00:00Z',
      endTime: '2026-01-01T17:00:00Z',
    };

    it('creates a template', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 1 });
      prisma.masterShiftTemplate.create.mockResolvedValue(template);
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

    it('rejects a duplicate branch+name (P2002 -> 400)', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 1 });
      prisma.masterShiftTemplate.create.mockRejectedValue(p2002);
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prisma.masterShiftTemplate.findMany.mockResolvedValue([]);
      await service.findAll(managedBranchAbility);
      expect(prisma.masterShiftTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              accessibleWhere(
                managedBranchAbility,
                'read',
                'master-shift-templates',
              ),
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.masterShiftTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prisma.masterShiftTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(1, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.masterShiftTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            AND: [
              accessibleWhere(
                managedBranchAbility,
                'read',
                'master-shift-templates',
              ),
            ],
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { name: 'Evening' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when reassigning to a missing branch', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(template);
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.update(1, { branchId: 999 }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates a template', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(template);
      prisma.masterShiftTemplate.update.mockResolvedValue({
        ...template,
        name: 'Evening',
      });
      const result = await service.update(1, { name: 'Evening' }, 1);
      expect(result.name).toBe('Evening');
    });
  });

  describe('remove', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes a template', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue(template);
      const result = await service.remove(1);
      expect(prisma.masterShiftTemplate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.message).toBeDefined();
    });
  });
});
