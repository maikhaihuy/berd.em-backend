import { Shift } from '@prisma/client';
import { ShiftDto, ShiftLiteDto } from './dto/shift.dto';

export class ShiftMapper {
  static toShiftDto(shift: Shift): ShiftDto {
    return {
      id: shift.id,
      branchId: shift.branchId,
      name: shift.name,
      abbreviation: shift.abbreviation,
      maxSlots: shift.maxSlots,
      startTime: shift.startTime,
      endTime: shift.endTime,
      multiplier: shift.multiplier,
      status: shift.status,
      createdAt: shift.createdAt,
      createdBy: shift.createdBy,
      updatedAt: shift.updatedAt,
      updatedBy: shift.updatedBy,
    };
  }

  static toShiftLiteDto(shift: Shift): ShiftLiteDto {
    return {
      id: shift.id,
      name: shift.name,
      abbreviation: shift.abbreviation,
      startTime: shift.startTime,
      endTime: shift.endTime,
      multiplier: shift.multiplier,
      status: shift.status,
    };
  }

  static toDtos(shifts: Shift[]): ShiftDto[] {
    return shifts.map((shift) => this.toShiftDto(shift));
  }

  static toLiteDtos(shifts: Shift[]): ShiftLiteDto[] {
    return shifts.map((shift) => this.toShiftLiteDto(shift));
  }
}
