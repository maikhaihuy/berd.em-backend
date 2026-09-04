/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BranchesService } from './branch.service';
import { PrismaService } from '../prisma/prisma.service';

const p2002 = new Prisma.PrismaClientKnownRequestError('unique', {
  code: 'P2002',
  clientVersion: 'test',
});
const p2025 = new Prisma.PrismaClientKnownRequestError('missing', {
  code: 'P2025',
  clientVersion: 'test',
});

describe('BranchesService', () => {
  let prisma: {
    branch: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: BranchesService;

  const branch = {
    id: 1,
    name: 'Downtown',
    abbreviation: 'DT',
    address: '123 Main St',
    email: null,
    phone: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      branch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new BranchesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a branch', async () => {
      prisma.branch.create.mockResolvedValue(branch);
      const result = await service.create(
        { name: 'Downtown', abbreviation: 'DT', address: '123 Main St' },
        1,
      );
      expect(result.id).toBe(1);
      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Downtown',
            createdBy: 1,
            updatedBy: 1,
          }),
        }),
      );
    });

    it('rejects a duplicate name/abbreviation (P2002 -> 400)', async () => {
      prisma.branch.create.mockRejectedValue(p2002);
      await expect(
        service.create(
          { name: 'Downtown', abbreviation: 'DT', address: '123 Main St' },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns all branches', async () => {
      prisma.branch.findMany.mockResolvedValue([branch]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns a branch by id', async () => {
      prisma.branch.findUnique.mockResolvedValue(branch);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFound for a missing branch', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a branch', async () => {
      prisma.branch.update.mockResolvedValue({ ...branch, name: 'Uptown' });
      const result = await service.update(1, { name: 'Uptown' }, 1);
      expect(result.name).toBe('Uptown');
    });

    it('throws NotFound updating a missing branch (P2025)', async () => {
      prisma.branch.update.mockRejectedValue(p2025);
      await expect(
        service.update(99, { name: 'Uptown' }, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a branch', async () => {
      prisma.branch.delete.mockResolvedValue(branch);
      await service.remove(1);
      expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFound deleting a missing branch (P2025)', async () => {
      prisma.branch.delete.mockRejectedValue(p2025);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
