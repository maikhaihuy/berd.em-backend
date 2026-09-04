import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma, PayPeriodStatus, TimeLogStatus } from '@prisma/client';
import { PayrollEntryResponseDto } from './dto/payroll-entry-response.dto';
import { GeneratePayrollEntriesResultDto } from './dto/payroll-entry-response.dto';
import { PayrollEntrySummaryResponseDto } from './dto/payroll-entry-summary-response.dto';
import { PayrollEntrySummaryQueryDto } from './dto/payroll-entry-summary-query.dto';
import { payrollEntryInclude } from './payroll-entry.types';
import { PayrollEntryMapper } from './payroll-entry.mapper';
import { AppAbility } from '@modules/casl/casl-ability.factory';
import { accessibleWhere } from '@modules/casl/accessible-where';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

const MS_PER_HOUR = 1000 * 60 * 60;
const SUBJECT = 'payroll-entries';

@Injectable()
export class PayrollEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(
    payPeriodId: number | undefined,
    employeeId: number | undefined,
    ability: AppAbility,
  ): Promise<PayrollEntryResponseDto[]> {
    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        ...(payPeriodId ? { payPeriodId } : {}),
        ...(employeeId ? { employeeId } : {}),
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: payrollEntryInclude,
      orderBy: { workDate: 'desc' },
    });
    return PayrollEntryMapper.toDtos(entries);
  }

  async findOne(
    id: number,
    ability: AppAbility,
  ): Promise<PayrollEntryResponseDto> {
    const entry = await this.prisma.payrollEntry.findFirst({
      where: { id, AND: [accessibleWhere(ability, 'read', SUBJECT)] },
      include: payrollEntryInclude,
    });
    if (!entry) {
      throw new NotFoundException(`Payroll entry with ID ${id} not found.`);
    }
    return PayrollEntryMapper.toDto(entry);
  }

  async updateBonus(
    id: number,
    bonus: number,
    currentUserId: number,
  ): Promise<PayrollEntryResponseDto> {
    const before = await this.prisma.payrollEntry.findUnique({
      where: { id },
    });
    if (!before) {
      throw new NotFoundException(`Payroll entry with ID ${id} not found.`);
    }

    const entry = await this.prisma.payrollEntry.update({
      where: { id },
      data: { bonus, updatedBy: currentUserId },
      include: payrollEntryInclude,
    });

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'update',
      subject: SUBJECT,
      entityId: id,
      before,
      after: entry,
    });

    return PayrollEntryMapper.toDto(entry);
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    let deleted;
    try {
      deleted = await this.prisma.payrollEntry.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Payroll entry with ID ${id} not found.`);
      }
      throw error;
    }

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'delete',
      subject: SUBJECT,
      entityId: id,
      before: deleted,
    });
  }

  /**
   * Create one PayrollEntry per VERIFIED TimeLog in the pay period's date range
   * that does not yet have an entry. Idempotent: re-running only picks up time
   * logs with no existing PayrollEntry. Time logs with no applicable hourly rate
   * (or no clocked start/end time) are skipped and reported, never dropped
   * silently, and never fail the whole call.
   */
  async generate(
    payPeriodId: number,
    currentUserId: number,
  ): Promise<GeneratePayrollEntriesResultDto> {
    const payPeriod = await this.prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
    });
    if (!payPeriod) {
      throw new NotFoundException(
        `Pay period with ID ${payPeriodId} not found.`,
      );
    }

    const eligibleTimeLogs = await this.prisma.timeLog.findMany({
      where: {
        status: TimeLogStatus.VERIFIED,
        payrollEntry: { is: null },
        actualStartTime: {
          gte: payPeriod.startDate,
          lte: payPeriod.endDate,
        },
      },
    });

    const created: PayrollEntryResponseDto[] = [];
    const skipped: { timeLogId: number; reason: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const timeLog of eligibleTimeLogs) {
        if (!timeLog.actualStartTime || !timeLog.actualEndTime) {
          skipped.push({
            timeLogId: timeLog.id,
            reason: 'Time log has no actual start/end time',
          });
          continue;
        }

        const workDate = timeLog.actualStartTime;

        const rate = await tx.employeeHourlyRate.findFirst({
          where: {
            employeeId: timeLog.employeeId,
            effectiveDate: { lte: workDate },
            OR: [{ endDate: null }, { endDate: { gte: workDate } }],
          },
          orderBy: { effectiveDate: 'desc' },
        });

        if (!rate) {
          skipped.push({
            timeLogId: timeLog.id,
            reason: 'No applicable hourly rate for work date',
          });
          continue;
        }

        const hours =
          (timeLog.actualEndTime.getTime() -
            timeLog.actualStartTime.getTime()) /
          MS_PER_HOUR;

        const totalPay = new Prisma.Decimal(hours)
          .mul(rate.rate)
          .mul(timeLog.multiplier)
          .toDecimalPlaces(2);

        const entry = await tx.payrollEntry.create({
          data: {
            timeLogId: timeLog.id,
            employeeId: timeLog.employeeId,
            payPeriodId: payPeriod.id,
            payDate: payPeriod.endDate,
            workDate,
            calculatedAt: new Date(),
            calculatedBy: currentUserId,
            totalPay,
            createdBy: currentUserId,
            updatedBy: currentUserId,
          },
          include: payrollEntryInclude,
        });

        await this.auditLogsService.record(
          {
            actorId: currentUserId,
            action: 'generate',
            subject: SUBJECT,
            entityId: entry.id,
            after: entry,
          },
          tx,
        );

        created.push(PayrollEntryMapper.toDto(entry));
      }
    });

    return { created, skipped };
  }

  /**
   * Month-to-date earnings breakdown for one employee, plus their most
   * recently finalized pay period's paid total. The regular/overtime split
   * is derived from each entry's TimeLog.overtimeMinutes on read (see
   * expose-employee-facing-earnings-summary design.md Decision 2) rather
   * than stored, since totalPay itself only ever stores a combined figure.
   */
  async summary(
    query: PayrollEntrySummaryQueryDto,
    ability: AppAbility,
    callerEmployeeId: number | undefined,
  ): Promise<PayrollEntrySummaryResponseDto> {
    const employeeId = query.employeeId ?? callerEmployeeId;
    if (!employeeId) {
      throw new BadRequestException(
        'employeeId is required (no employeeId query param and no employee linked to the caller)',
      );
    }

    const now = new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to
      ? new Date(query.to)
      : new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        );

    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        employeeId,
        workDate: { gte: from, lte: to },
        AND: [accessibleWhere(ability, 'read', SUBJECT)],
      },
      include: { timeLog: true },
    });

    let shiftPay = 0;
    let approvedOt = 0;
    let bonus = 0;

    for (const entry of entries) {
      const totalPay = PayrollEntryService.toNumber(entry.totalPay);
      bonus += PayrollEntryService.toNumber(entry.bonus);

      const timeLog = entry.timeLog;
      const overtimeMinutes = timeLog?.overtimeMinutes ?? 0;
      const hours =
        timeLog?.actualStartTime && timeLog?.actualEndTime
          ? (timeLog.actualEndTime.getTime() -
              timeLog.actualStartTime.getTime()) /
            MS_PER_HOUR
          : 0;

      if (hours <= 0 || overtimeMinutes <= 0) {
        shiftPay += totalPay;
        continue;
      }

      const otPay = (totalPay / hours) * (overtimeMinutes / 60);
      approvedOt += otPay;
      shiftPay += totalPay - otPay;
    }

    const previousPeriod = await this.findPreviousFinalizedPeriod(employeeId);

    return {
      employeeId,
      from,
      to,
      shiftPay: PayrollEntryService.round2(shiftPay),
      approvedOt: PayrollEntryService.round2(approvedOt),
      bonus: PayrollEntryService.round2(bonus),
      total: PayrollEntryService.round2(shiftPay + approvedOt + bonus),
      previousPeriod,
    };
  }

  private async findPreviousFinalizedPeriod(
    employeeId: number,
  ): Promise<PayrollEntrySummaryResponseDto['previousPeriod']> {
    const period = await this.prisma.payPeriod.findFirst({
      where: {
        status: PayPeriodStatus.FINALIZED,
        payrollEntries: { some: { employeeId } },
      },
      orderBy: { endDate: 'desc' },
    });
    if (!period) {
      return null;
    }

    const agg = await this.prisma.payrollEntry.aggregate({
      where: { payPeriodId: period.id, employeeId },
      _sum: { totalPay: true, bonus: true },
    });

    const totalPaid =
      PayrollEntryService.toNumber(agg._sum.totalPay ?? 0) +
      PayrollEntryService.toNumber(agg._sum.bonus ?? 0);

    return {
      payPeriodId: period.id,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      totalPaid: PayrollEntryService.round2(totalPaid),
    };
  }

  private static toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : parseFloat(String(value));
  }

  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
