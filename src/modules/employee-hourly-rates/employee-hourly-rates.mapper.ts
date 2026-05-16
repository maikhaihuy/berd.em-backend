import { EmployeeHourlyRate } from '@prisma/client';
import { EmployeeHourlyRateResponseDto } from './dto/employee-hourly-rate-response.dto';
import {
  EmployeeHourlyRateDto,
  EmployeeHourlyRateLiteDto,
} from './dto/employee-hourly-rate.dto';
import { EmployeeHourlyRateWithEmployee } from './employee-hourly-rates.types';
import { EmployeeMapper } from '@modules/employees/employee.mapper';

export class EmployeeHourlyRatesMapper {
  // 🧱 Base mapper
  static mapBase(
    this: void,
    hourlyRate: EmployeeHourlyRate,
  ): EmployeeHourlyRateDto {
    return {
      id: hourlyRate.id,
      employeeId: hourlyRate.employeeId,
      rate:
        typeof hourlyRate.rate === 'number'
          ? hourlyRate.rate
          : parseFloat(String(hourlyRate.rate)),
      effectiveDate: hourlyRate.effectiveDate,
      endDate: hourlyRate.endDate ?? undefined,
      note: hourlyRate.note ?? undefined,
      createdAt: hourlyRate.createdAt,
      createdBy: hourlyRate.createdBy,
      updatedAt: hourlyRate.updatedAt,
      updatedBy: hourlyRate.updatedBy,
    };
  }

  static mapLite(
    this: void,
    hourlyRate: EmployeeHourlyRate,
  ): EmployeeHourlyRateLiteDto {
    return {
      id: hourlyRate.id,
      employeeId: hourlyRate.employeeId,
      rate:
        typeof hourlyRate.rate === 'number'
          ? hourlyRate.rate
          : parseFloat(String(hourlyRate.rate)),
      effectiveDate: hourlyRate.effectiveDate,
      endDate: hourlyRate.endDate ?? undefined,
      note: hourlyRate.note ?? undefined,
    };
  }

  static mapEmployee(
    this: void,
    hourlyRate: Partial<EmployeeHourlyRate & EmployeeHourlyRateWithEmployee>,
  ): Partial<EmployeeHourlyRateResponseDto> {
    return {
      employee: hourlyRate.employee
        ? EmployeeMapper.mapLite(hourlyRate.employee)
        : undefined,
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    hourlyRate: Partial<EmployeeHourlyRate & EmployeeHourlyRateWithEmployee>,
  ): EmployeeHourlyRateResponseDto {
    return {
      ...EmployeeHourlyRatesMapper.mapBase(hourlyRate as EmployeeHourlyRate),
      ...EmployeeHourlyRatesMapper.mapEmployee(hourlyRate),
    } as EmployeeHourlyRateResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(
    hourlyRates: EmployeeHourlyRateWithEmployee[],
  ): EmployeeHourlyRateResponseDto[] {
    return hourlyRates.map(EmployeeHourlyRatesMapper.toDto);
  }
}
