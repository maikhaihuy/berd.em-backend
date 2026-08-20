import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchScheduleConfigService } from './branch-schedule-config.service';
import { PrismaService } from '@modules/prisma/prisma.service';

const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
  code: 'P2002',
  clientVersion: 'test',
});
const p2025 = new Prisma.PrismaClientKnownRequestError('missing', {
  code: 'P2025',
  clientVersion: 'test',
});

describe('BranchScheduleConfigService', () => {
  let prisma: {
    branchScheduleConfig: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: BranchScheduleConfigService;

  const config = {
    id: 1,
    branchId: 2,
    allowCustomAvailabilityTime: false,
    availabilityOpenDaysBefore: 7,
    availabilityCloseHoursBefore: 12,
    scheduleGenerationDay: 25,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      branchScheduleConfig: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new BranchScheduleConfigService(
      prisma as unknown as PrismaService,
    );
  });

  it('creates a config', async () => {
    prisma.branchScheduleConfig.create.mockResolvedValue(config);
    const result = await service.create({ branchId: 2 }, 1);
    expect(result.branchId).toBe(2);
  });

  it('rejects a duplicate config for a branch (P2002 -> 400)', async () => {
    prisma.branchScheduleConfig.create.mockRejectedValue(p2002);
    await expect(service.create({ branchId: 2 }, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws NotFound for a missing config by id', async () => {
    prisma.branchScheduleConfig.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the config for a branch', async () => {
    prisma.branchScheduleConfig.findUnique.mockResolvedValue(config);
    const result = await service.findByBranch(2);
    expect(result.branchId).toBe(2);
    expect(prisma.branchScheduleConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 2 } }),
    );
  });

  it('throws NotFound when a branch has no config', async () => {
    prisma.branchScheduleConfig.findUnique.mockResolvedValue(null);
    await expect(service.findByBranch(2)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a config', async () => {
    prisma.branchScheduleConfig.update.mockResolvedValue({
      ...config,
      scheduleGenerationDay: 1,
    });
    const result = await service.update(1, { scheduleGenerationDay: 1 }, 1);
    expect(result.scheduleGenerationDay).toBe(1);
  });

  it('throws NotFound updating a missing config (P2025)', async () => {
    prisma.branchScheduleConfig.update.mockRejectedValue(p2025);
    await expect(service.update(99, { note: 'x' }, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes a config', async () => {
    prisma.branchScheduleConfig.delete.mockResolvedValue(config);
    await service.remove(1);
    expect(prisma.branchScheduleConfig.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('throws NotFound deleting a missing config (P2025)', async () => {
    prisma.branchScheduleConfig.delete.mockRejectedValue(p2025);
    await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
