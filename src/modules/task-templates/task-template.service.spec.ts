/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskType } from '@prisma/client';
import { TaskTemplatesService } from './task-template.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { LoggerService } from '@common/logger/logger.service';

const caslAbilityFactory = new CaslAbilityFactory({
  warn: jest.fn(),
} as unknown as LoggerService);
const unscopedAbility = caslAbilityFactory.createForUser({
  permissions: [{ action: 'read', subject: 'task-templates' }],
});
const managedBranchAbility = caslAbilityFactory.createForUser({
  permissions: [
    {
      action: 'read',
      subject: 'task-templates',
      condition: { branchId: { in: '$managedBranches' } },
    },
  ],
  managedBranches: [1],
});

describe('TaskTemplatesService', () => {
  let prisma: {
    taskTemplate: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    subShiftTemplate: { findUnique: jest.Mock };
    masterShiftTemplate: { findUnique: jest.Mock };
  };
  let service: TaskTemplatesService;

  const template = {
    id: 1,
    branchId: 1,
    masterShiftTemplateId: 10,
    subShiftTemplateId: null,
    title: 'Open shop',
    description: null,
    type: TaskType.SHARED_MANDATORY,
    isActive: true,
    sortOrder: 0,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      taskTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      subShiftTemplate: { findUnique: jest.fn() },
      masterShiftTemplate: { findUnique: jest.fn() },
    };
    service = new TaskTemplatesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a shared task template targeting a master shift template', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 10,
        branchId: 1,
      });
      prisma.taskTemplate.create.mockResolvedValue(template);
      const result = await service.create(
        {
          branchId: 1,
          masterShiftTemplateId: 10,
          title: 'Open shop',
          type: TaskType.SHARED_MANDATORY,
        },
        1,
      );
      expect(result.id).toBe(1);
    });

    it('rejects a shared task template that also targets a sub shift template', async () => {
      await expect(
        service.create(
          {
            branchId: 1,
            masterShiftTemplateId: 10,
            subShiftTemplateId: 5,
            title: 'Open shop',
            type: TaskType.SHARED_MANDATORY,
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a shared task template branch mismatch', async () => {
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 10,
        branchId: 2,
      });
      await expect(
        service.create(
          {
            branchId: 1,
            masterShiftTemplateId: 10,
            title: 'Open shop',
            type: TaskType.SHARED_MANDATORY,
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a dedicated task template targeting a sub shift template', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue({
        id: 5,
        branchId: 1,
      });
      prisma.taskTemplate.create.mockResolvedValue({
        ...template,
        masterShiftTemplateId: null,
        subShiftTemplateId: 5,
        type: TaskType.DEDICATED,
      });
      const result = await service.create(
        {
          branchId: 1,
          subShiftTemplateId: 5,
          title: 'Clean counter',
          type: TaskType.DEDICATED,
        },
        1,
      );
      expect(result.id).toBe(1);
    });

    it('rejects a dedicated task template that also targets a master shift template', async () => {
      await expect(
        service.create(
          {
            branchId: 1,
            masterShiftTemplateId: 10,
            subShiftTemplateId: 5,
            title: 'Clean counter',
            type: TaskType.DEDICATED,
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a dedicated task template branch mismatch', async () => {
      prisma.subShiftTemplate.findUnique.mockResolvedValue({
        id: 5,
        branchId: 2,
      });
      await expect(
        service.create(
          {
            branchId: 1,
            subShiftTemplateId: 5,
            title: 'Clean counter',
            type: TaskType.DEDICATED,
          },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('scopes the list by the caller managed-branch ability', async () => {
      prisma.taskTemplate.findMany.mockResolvedValue([]);
      await service.findAll(managedBranchAbility);
      expect(prisma.taskTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              accessibleWhere(managedBranchAbility, 'read', 'task-templates'),
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.taskTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(999, unscopedAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes the lookup by the caller managed-branch ability', async () => {
      prisma.taskTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(1, managedBranchAbility),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.taskTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            AND: [
              accessibleWhere(managedBranchAbility, 'read', 'task-templates'),
            ],
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.taskTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.update(99, { title: 'Close shop' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('re-validates scope against the merged dto before updating', async () => {
      prisma.taskTemplate.findUnique.mockResolvedValue(template);
      prisma.masterShiftTemplate.findUnique.mockResolvedValue({
        id: 10,
        branchId: 1,
      });
      prisma.taskTemplate.update.mockResolvedValue({
        ...template,
        title: 'Close shop',
      });
      const result = await service.update(1, { title: 'Close shop' }, 1);
      expect(result.title).toBe('Close shop');
    });
  });

  describe('remove', () => {
    it('throws NotFound when the template does not exist', async () => {
      prisma.taskTemplate.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes a task template', async () => {
      prisma.taskTemplate.findUnique.mockResolvedValue(template);
      const result = await service.remove(1);
      expect(prisma.taskTemplate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.message).toBeDefined();
    });
  });
});
