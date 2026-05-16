import { WorkSlot } from '@prisma/client';
import { WorkSlotResponseDto } from './dto/work-slot-response.dto';
import { WorkSlotDto, WorkSlotLiteDto } from './dto/work-slot.dto';
import { WorkSlotWithBranchAndEmployee } from './work-slot.types';

export class WorkSlotMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, workSlot: WorkSlot): WorkSlotDto {
    return {
      id: workSlot.id,
      branchId: workSlot.branchId,
      employeeId: workSlot.employeeId,
      assignedAt: workSlot.assignedAt,
      startTime: workSlot.startTime,
      endTime: workSlot.endTime,
      actualStartTime: workSlot.actualStartTime,
      actualEndTime: workSlot.actualEndTime,
      status: workSlot.status,
      note: workSlot.note,
      createdAt: workSlot.createdAt,
      createdBy: workSlot.createdBy,
      updatedAt: workSlot.updatedAt,
      updatedBy: workSlot.updatedBy,
    };
  }

  static mapLite(this: void, workSlot: WorkSlot): WorkSlotLiteDto {
    return {
      id: workSlot.id,
      branchId: workSlot.branchId,
      employeeId: workSlot.employeeId,
      assignedAt: workSlot.assignedAt,
      startTime: workSlot.startTime,
      endTime: workSlot.endTime,
      actualStartTime: workSlot.actualStartTime,
      actualEndTime: workSlot.actualEndTime,
      status: workSlot.status,
      note: workSlot.note,
    };
  }

  static mapBranchAndEmployee(
    workSlot: Partial<WorkSlot & WorkSlotWithBranchAndEmployee>,
  ): Partial<WorkSlotResponseDto> {
    return {
      branchName: workSlot.branch?.name,
      branchAbbreviation: workSlot.branch?.abbreviation,
      employeeFullName: workSlot.employee
        ? workSlot.employee.fullName
        : undefined,
      employeePhoneNumber: workSlot.employee
        ? workSlot.employee.phoneNumber
        : undefined,
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    workSlot: Partial<WorkSlot & WorkSlotWithBranchAndEmployee>,
  ): WorkSlotResponseDto {
    return {
      ...WorkSlotMapper.mapBase(workSlot as WorkSlot),
      ...WorkSlotMapper.mapBranchAndEmployee(workSlot),
    } as WorkSlotResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(
    workSlots: WorkSlotWithBranchAndEmployee[],
  ): WorkSlotResponseDto[] {
    return workSlots.map(WorkSlotMapper.toDto);
  }
}
