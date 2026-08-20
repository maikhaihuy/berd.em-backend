/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayPeriodStatus } from '@prisma/client';
import { PayPeriodService } from './pay-period.service';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('PayPeriodService', () => {
  let prisma: {
    payPeriod: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: PayPeriodService;

  const base = {
    id: 1,
    startDate: new Date('2026-08-01T00:00:00Z'),
    endDate: new Date('2026-08-15T00:00:00Z'),
    notes: null,
    createdAt: new Date(),
    createdBy: 1,
    updatedAt: new Date(),
    updatedBy: 1,
  };

  beforeEach(() => {
    prisma = {
      payPeriod: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new PayPeriodService(prisma as unknown as PrismaService);
  });

  it('creates a pay period with status OPEN', async () => {
    prisma.payPeriod.create.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.OPEN,
    });

    const result = await service.create(
      {
        startDate: base.startDate.toISOString(),
        endDate: base.endDate.toISOString(),
      },
      1,
    );

    expect(result.status).toBe(PayPeriodStatus.OPEN);
    expect(prisma.payPeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayPeriodStatus.OPEN }),
      }),
    );
  });

  it('throws NotFound when fetching a missing pay period', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes an OPEN pay period -> CLOSED', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.OPEN,
    });
    prisma.payPeriod.update.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.CLOSED,
    });

    const result = await service.close(1, 1);

    expect(result.status).toBe(PayPeriodStatus.CLOSED);
    expect(prisma.payPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayPeriodStatus.CLOSED }),
      }),
    );
  });

  it('rejects close on an already-CLOSED pay period', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.CLOSED,
    });
    await expect(service.close(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.payPeriod.update).not.toHaveBeenCalled();
  });

  it('finalizes a CLOSED pay period -> FINALIZED', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.CLOSED,
    });
    prisma.payPeriod.update.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.FINALIZED,
    });

    const result = await service.finalize(1, 1);
    expect(result.status).toBe(PayPeriodStatus.FINALIZED);
  });

  it('rejects finalize on an OPEN pay period', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue({
      ...base,
      status: PayPeriodStatus.OPEN,
    });
    await expect(service.finalize(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.payPeriod.update).not.toHaveBeenCalled();
  });
});
