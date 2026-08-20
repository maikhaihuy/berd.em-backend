import { PayrollEntryResponseDto } from './dto/payroll-entry-response.dto';
import { PayrollEntryWithRelations } from './payroll-entry.types';

export class PayrollEntryMapper {
  static toDto(
    this: void,
    entry: PayrollEntryWithRelations,
  ): PayrollEntryResponseDto {
    return {
      id: entry.id,
      timeLogId: entry.timeLogId,
      employeeId: entry.employeeId,
      payPeriodId: entry.payPeriodId,
      payDate: entry.payDate,
      workDate: entry.workDate,
      calculatedAt: entry.calculatedAt,
      calculatedBy: entry.calculatedBy,
      // Decimal -> number, matching the EmployeeHourlyRatesMapper convention.
      totalPay:
        typeof entry.totalPay === 'number'
          ? entry.totalPay
          : parseFloat(String(entry.totalPay)),
      timeLog: entry.timeLog,
      employee: entry.employee,
      payPeriod: entry.payPeriod,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
      updatedAt: entry.updatedAt,
      updatedBy: entry.updatedBy,
    };
  }

  static toDtos(
    entries: PayrollEntryWithRelations[],
  ): PayrollEntryResponseDto[] {
    return entries.map(PayrollEntryMapper.toDto);
  }
}
