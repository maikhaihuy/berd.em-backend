import { Shift } from '@prisma/client';
import { ShiftDto, ShiftLiteDto } from './dto/shift.dto';
import { ShiftResponseDto } from './dto/shift-response.dto';
import { ShiftWithBranch } from './shift.types';
import { BranchMapper } from '../branches/branch.mapper';

export class ShiftMapper {
  static mapBase(shift: Shift): ShiftDto {
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

  static mapLite(shift: Shift): ShiftLiteDto {
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

  static mapBranch(
    shift: Partial<Shift & ShiftWithBranch>,
  ): Partial<ShiftResponseDto> {
    return {
      branch: BranchMapper.mapLite(shift.branch!),
    };
  }

  static toDto(shift: Shift): ShiftResponseDto {
    return {
      ...this.mapBase(shift),
      ...this.mapBranch(shift),
    } as ShiftResponseDto;
  }

  static toDtos(shifts: Shift[]): ShiftResponseDto[] {
    return shifts.map((shift) => this.toDto(shift));
  }
}
