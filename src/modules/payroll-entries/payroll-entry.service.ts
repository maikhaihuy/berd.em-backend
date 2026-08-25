import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma, TimeLogStatus } from '@prisma/client';
import { PayrollEntryResponseDto } from './dto/payroll-entry-response.dto';
import { GeneratePayrollEntriesResultDto } from './dto/payroll-entry-response.dto';
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
}
