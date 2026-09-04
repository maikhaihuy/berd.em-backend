/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeeHourlyRatesService } from './employee-hourly-rates.service';
import { PrismaService } from '../prisma/prisma.service';

const p2025 = new Prisma.PrismaClientKnownRequestError('missing', {
  code: 'P2025',
  clientVersion: 'test',
});

describe('EmployeeHourlyRatesService', () => {
  let prisma: {
    employeeHourlyRate: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: EmployeeHourlyRatesService;

  const hourlyRate = {
    id: 1,
    employeeId: 5,
    rate: new Prisma.Decimal(25),
    effectiveDate: new Date('2026-01-01'),
    endDate: null,
    note: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      employeeHourlyRate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new EmployeeHourlyRatesService(
      prisma as unknown as PrismaService,
    );
  });

  describe('create', () => {
    it('creates an hourly rate', async () => {
      prisma.employeeHourlyRate.create.mockResolvedValue(hourlyRate);
      const result = await service.create(
        { employeeId: 5, rate: 25, effectiveDate: new Date('2026-01-01') },
        1,
      );
      expect(result.id).toBe(1);
      expect(prisma.employeeHourlyRate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 5,
            createdBy: 1,
            updatedBy: 1,
          }),
        }),
      );
    });

    it('throws NotFound when the employee does not exist (P2025)', async () => {
      prisma.employeeHourlyRate.create.mockRejectedValue(p2025);
      await expect(
        service.create(
          { employeeId: 999, rate: 25, effectiveDate: new Date('2026-01-01') },
          1,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all hourly rates', async () => {
      prisma.employeeHourlyRate.findMany.mockResolvedValue([hourlyRate]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns an hourly rate by id', async () => {
      prisma.employeeHourlyRate.findUnique.mockResolvedValue(hourlyRate);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFound for a missing hourly rate', async () => {
      prisma.employeeHourlyRate.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates an hourly rate', async () => {
      prisma.employeeHourlyRate.update.mockResolvedValue({
        ...hourlyRate,
        rate: new Prisma.Decimal(30),
      });
      const result = await service.update(1, { rate: 30 }, 1);
      expect(result.rate).toBe(30);
    });

    it('throws NotFound updating a missing hourly rate (P2025)', async () => {
      prisma.employeeHourlyRate.update.mockRejectedValue(p2025);
      await expect(service.update(99, { rate: 30 }, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes an hourly rate', async () => {
      prisma.employeeHourlyRate.delete.mockResolvedValue(hourlyRate);
      await service.remove(1);
      expect(prisma.employeeHourlyRate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws NotFound deleting a missing hourly rate (P2025)', async () => {
      prisma.employeeHourlyRate.delete.mockRejectedValue(p2025);
      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
