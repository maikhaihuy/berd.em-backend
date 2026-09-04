/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PayPeriodStatus, TimeLogStatus } from '@prisma/client';
import { PayrollEntryService } from './payroll-entry.service';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CaslAbilityFactory } from '@modules/casl/casl-ability.factory';
import { LoggerService } from '@common/logger/logger.service';

describe('PayrollEntryService.generate', () => {
  let auditLogsService: { record: jest.Mock };
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
    auditLogsService = { record: jest.fn() };
    service = new PayrollEntryService(
      prisma as unknown as PrismaService,
      auditLogsService as any,
    );
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
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        action: 'generate',
        subject: 'payroll-entries',
      }),
      prisma, // the transaction client, not the app-wide prisma instance
    );
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
  const caslAbilityFactory = new CaslAbilityFactory({
    warn: jest.fn(),
  } as unknown as LoggerService);

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
        delete: jest.fn(),
      } as any,
    };
    service = new PayrollEntryService(
      prisma as PrismaService,
      { record: jest.fn() } as any,
    );
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

describe('PayrollEntryService.updateBonus', () => {
  let auditLogsService: { record: jest.Mock };
  let prisma: {
    payrollEntry: { findUnique: jest.Mock; update: jest.Mock };
  };
  let service: PayrollEntryService;

  beforeEach(() => {
    prisma = {
      payrollEntry: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditLogsService = { record: jest.fn() };
    service = new PayrollEntryService(
      prisma as unknown as PrismaService,
      auditLogsService as any,
    );
  });

  it('throws NotFound when the entry does not exist', async () => {
    prisma.payrollEntry.findUnique.mockResolvedValue(null);

    await expect(service.updateBonus(1, 50, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.payrollEntry.update).not.toHaveBeenCalled();
  });

  it('updates bonus, leaves other fields untouched, and records an audit log entry', async () => {
    const before = { id: 1, bonus: new Prisma.Decimal(0) };
    const after = {
      id: 1,
      timeLogId: 10,
      employeeId: 5,
      payPeriodId: 1,
      payDate: new Date(),
      workDate: new Date(),
      calculatedAt: new Date(),
      calculatedBy: 1,
      totalPay: new Prisma.Decimal(100),
      bonus: new Prisma.Decimal(50),
      timeLog: {},
      employee: {},
      payPeriod: {},
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 7,
    };
    prisma.payrollEntry.findUnique.mockResolvedValue(before);
    prisma.payrollEntry.update.mockResolvedValue(after);

    const result = await service.updateBonus(1, 50, 7);

    expect(prisma.payrollEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { bonus: 50, updatedBy: 7 },
      }),
    );
    expect(result.bonus).toBe(50);
    expect(result.totalPay).toBe(100);
    expect(auditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 7,
        action: 'update',
        subject: 'payroll-entries',
        entityId: 1,
        before,
        after,
      }),
    );
  });
});

describe('PayrollEntryService.summary', () => {
  let prisma: {
    payrollEntry: { findMany: jest.Mock; aggregate: jest.Mock };
    payPeriod: { findFirst: jest.Mock };
  };
  let service: PayrollEntryService;
  const caslAbilityFactory = new CaslAbilityFactory({
    warn: jest.fn(),
  } as unknown as LoggerService);
  const ability = caslAbilityFactory.createForUser({
    permissions: [{ action: 'read', subject: 'payroll-entries' }],
  });

  beforeEach(() => {
    prisma = {
      payrollEntry: { findMany: jest.fn(), aggregate: jest.fn() },
      payPeriod: { findFirst: jest.fn() },
    };
    prisma.payPeriod.findFirst.mockResolvedValue(null);
    service = new PayrollEntryService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as any,
    );
  });

  it('throws BadRequestException when no employeeId is available', async () => {
    await expect(
      service.summary({}, ability, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('splits shiftPay/approvedOt using timeLog.overtimeMinutes, not multiplier', async () => {
    prisma.payrollEntry.findMany.mockResolvedValue([
      {
        totalPay: new Prisma.Decimal(100),
        bonus: new Prisma.Decimal(0),
        timeLog: {
          actualStartTime: new Date('2026-09-01T08:00:00Z'),
          actualEndTime: new Date('2026-09-01T16:00:00Z'), // 8h shift
          overtimeMinutes: 60,
        },
      },
    ]);

    const result = await service.summary({ employeeId: 5 }, ability, undefined);

    expect(result.approvedOt).toBeCloseTo(12.5);
    expect(result.shiftPay).toBeCloseTo(87.5);
    expect(result.total).toBeCloseTo(100);
    expect(result.previousPeriod).toBeNull();
  });

  it('does not divide by zero for a zero-duration time log', async () => {
    prisma.payrollEntry.findMany.mockResolvedValue([
      {
        totalPay: new Prisma.Decimal(50),
        bonus: new Prisma.Decimal(0),
        timeLog: {
          actualStartTime: new Date('2026-09-01T08:00:00Z'),
          actualEndTime: new Date('2026-09-01T08:00:00Z'),
          overtimeMinutes: 30,
        },
      },
    ]);

    const result = await service.summary({ employeeId: 5 }, ability, undefined);

    expect(result.shiftPay).toBe(50);
    expect(result.approvedOt).toBe(0);
  });

  it('returns previousPeriod null when no FINALIZED period has entries', async () => {
    prisma.payrollEntry.findMany.mockResolvedValue([]);

    const result = await service.summary({ employeeId: 5 }, ability, undefined);

    expect(result.previousPeriod).toBeNull();
    expect(prisma.payrollEntry.aggregate).not.toHaveBeenCalled();
  });

  it('reports the most recent FINALIZED period and its totalPaid', async () => {
    prisma.payrollEntry.findMany.mockResolvedValue([]);
    prisma.payPeriod.findFirst.mockResolvedValue({
      id: 3,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-15T00:00:00Z'),
      status: PayPeriodStatus.FINALIZED,
    });
    prisma.payrollEntry.aggregate.mockResolvedValue({
      _sum: {
        totalPay: new Prisma.Decimal(200),
        bonus: new Prisma.Decimal(50),
      },
    });

    const result = await service.summary({ employeeId: 5 }, ability, undefined);

    expect(result.previousPeriod).toEqual(
      expect.objectContaining({ payPeriodId: 3, totalPaid: 250 }),
    );
  });
});
