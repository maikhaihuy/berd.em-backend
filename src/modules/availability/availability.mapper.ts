import { Availability } from '@prisma/client';
import { AvailabilityResponseDto } from './dto/availability-response.dto';
import { AvailabilityDto, AvailabilityLiteDto } from './dto/availability.dto';
import { AvailabilityWithEmployee } from './availability.types';
import { EmployeeMapper } from '@modules/employees/employee.mapper';

export class AvailabilityMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(availability: Availability): AvailabilityDto {
    return {
      id: availability.id,
      employeeId: availability.employeeId,
      startTime: availability.startTime,
      endTime: availability.endTime,
      note: availability.note,
      createdAt: availability.createdAt,
      createdBy: availability.createdBy,
      updatedAt: availability.updatedAt,
      updatedBy: availability.updatedBy,
    };
  }

  static mapLite(availability: Availability): AvailabilityLiteDto {
    return {
      id: availability.id,
      employeeId: availability.employeeId,
      startTime: availability.startTime,
      endTime: availability.endTime,
      note: availability.note,
    };
  }

  static mapEmployee(
    availability: Partial<Availability & AvailabilityWithEmployee>,
  ): Partial<AvailabilityResponseDto> {
    return {
      employee: availability.employee
        ? EmployeeMapper.mapLite(availability.employee)
        : undefined,
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    availability: Partial<Availability & AvailabilityWithEmployee>,
  ): AvailabilityResponseDto {
    return {
      ...AvailabilityMapper.mapBase(availability as Availability),
      ...AvailabilityMapper.mapEmployee(availability),
    } as AvailabilityResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(
    availabilities: AvailabilityWithEmployee[],
  ): AvailabilityResponseDto[] {
    return availabilities.map((a) => AvailabilityMapper.toDto(a));
  }
}
