/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { Prisma, PayPeriodStatus, TimeLogStatus } from '@prisma/client';
import { PayrollEntryService } from './payroll-entry.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';

describe('PayrollEntryService.generate', () => {
  let prisma: {
    payPeriod: { findUnique: jest.Mock };
    timeLog: { findMany: jest.Mock };
    employeeHourlyRate: { findFirst: jest.Mock };
    payrollEntry: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: PayrollEntryService;

  const payPeriod = {
    id: 1,
    startDate: new Date('2026-08-01T00:00:00Z'),
    endDate: new Date('2026-08-15T00:00:00Z'),
    status: PayPeriodStatus.OPEN,
  };

  // 08:00 -> 12:00 = 4 hours
  const timeLog = {
    id: 10,
    employeeId: 5,
    status: TimeLogStatus.VERIFIED,
    actualStartTime: new Date('2026-08-05T08:00:00Z'),
    actualEndTime: new Date('2026-08-05T12:00:00Z'),
    multiplier: new Prisma.Decimal('1.5'),
  };

  beforeEach(() => {
    prisma = {
      payPeriod: { findUnique: jest.fn() },
      timeLog: { findMany: jest.fn() },
      employeeHourlyRate: { findFirst: jest.fn() },
      payrollEntry: {
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 100,
            ...args.data,
            createdAt: new Date(),
            createdBy: 1,
            updatedAt: new Date(),
            updatedBy: 1,
          }),
        ),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new PayrollEntryService(prisma as unknown as PrismaService);
  });

  it('throws NotFound when the pay period does not exist', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(null);
    await expect(service.generate(1, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('computes totalPay = hours × rate × multiplier and creates one entry', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(payPeriod);
    prisma.timeLog.findMany.mockResolvedValue([timeLog]);
    prisma.employeeHourlyRate.findFirst.mockResolvedValue({
      id: 1,
      employeeId: 5,
      rate: new Prisma.Decimal('10.00'),
    });

    const result = await service.generate(1, 1);

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    // 4h × 10 × 1.5 = 60.00
    expect(result.created[0].totalPay).toBe(60);
    const createArgs = prisma.payrollEntry.create.mock.calls[0][0] as {
      data: {
        totalPay: Prisma.Decimal;
        timeLogId: number;
        payPeriodId: number;
      };
    };
    expect(createArgs.data.totalPay.toString()).toBe('60');
    expect(createArgs.data.timeLogId).toBe(10);
    expect(createArgs.data.payPeriodId).toBe(1);
  });

  it('is idempotent: no eligible time logs -> zero entries created', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(payPeriod);
    prisma.timeLog.findMany.mockResolvedValue([]);

    const result = await service.generate(1, 1);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(prisma.payrollEntry.create).not.toHaveBeenCalled();
  });

  it('skips and reports a time log with no applicable hourly rate', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(payPeriod);
    prisma.timeLog.findMany.mockResolvedValue([timeLog]);
    prisma.employeeHourlyRate.findFirst.mockResolvedValue(null);

    const result = await service.generate(1, 1);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual([
      { timeLogId: 10, reason: 'No applicable hourly rate for work date' },
    ]);
    expect(prisma.payrollEntry.create).not.toHaveBeenCalled();
  });

  it('skips a time log missing an actual end time', async () => {
    prisma.payPeriod.findUnique.mockResolvedValue(payPeriod);
    prisma.timeLog.findMany.mockResolvedValue([
      { ...timeLog, actualEndTime: null },
    ]);

    const result = await service.generate(1, 1);

    expect(result.created).toHaveLength(0);
    expect(result.skipped[0].reason).toBe(
      'Time log has no actual start/end time',
    );
    expect(prisma.employeeHourlyRate.findFirst).not.toHaveBeenCalled();
  });
});

describe('PayrollEntryService row-scoping', () => {
  let prisma: Partial<PrismaService>;
  let service: PayrollEntryService;
  const caslAbilityFactory = new CaslAbilityFactory();

  const unscopedAbility = caslAbilityFactory.createForUser({
    permissions: [{ action: 'read', subject: 'payroll-entries' }],
  });
  const scopedAbility = (employeeId: number) =>
    caslAbilityFactory.createForUser({
      employeeId,
      permissions: [
        {
          action: 'read',
          subject: 'payroll-entries',
          condition: { employeeId: '$self' },
        },
      ],
    });

  beforeEach(() => {
    prisma = {
      payrollEntry: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      } as any,
    };
    service = new PayrollEntryService(prisma as PrismaService);
  });

  describe('findAll', () => {
    it('applies no filter for an unscoped caller', async () => {
      (prisma.payrollEntry as any).findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, unscopedAbility);

      expect((prisma.payrollEntry as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{}] } }),
      );
    });

    it('filters to the caller when a self-scoped grant is present', async () => {
      (prisma.payrollEntry as any).findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, scopedAbility(42));

      expect((prisma.payrollEntry as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ OR: [{ employeeId: 42 }] }] },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404s when the row exists but belongs to another employee', async () => {
      (prisma.payrollEntry as any).findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(1, scopedAbility(42)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect((prisma.payrollEntry as any).findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, AND: [{ OR: [{ employeeId: 42 }] }] },
        }),
      );
    });
  });
});
