import { LeaveRequest } from '@prisma/client';
import { LeaveRequestDto } from './dto/leave-request.dto';
import { LeaveRequestLiteDto } from './dto/leave-request-lite.dto';
import { LeaveRequestResponseDto } from './dto/leave-request-response.dto';
import { LeaveRequestWithRelations } from './leave-request.types';

export class LeaveRequestMapper {
  // 🧱 Base mapper - essential fields only
  static mapBase(this: void, leaveRequest: LeaveRequest): LeaveRequestDto {
    return {
      id: leaveRequest.id,
      assignmentId: leaveRequest.assignmentId,
      absenceEmployeeId: leaveRequest.absenceEmployeeId,
      replacementEmployeeId: leaveRequest.replacementEmployeeId,
      approvedId: leaveRequest.approvedId,
      reason: leaveRequest.reason,
      note: leaveRequest.note,
      status: leaveRequest.status,
      approvedAt: leaveRequest.approvedAt,
      createdAt: leaveRequest.createdAt,
      createdBy: leaveRequest.createdBy,
      updatedAt: leaveRequest.updatedAt,
      updatedBy: leaveRequest.updatedBy,
    };
  }

  // 📦 Lite mapper - minimal fields for nested relations
  static mapLite(this: void, leaveRequest: LeaveRequest): LeaveRequestLiteDto {
    return {
      id: leaveRequest.id,
      assignmentId: leaveRequest.assignmentId,
      absenceEmployeeId: leaveRequest.absenceEmployeeId,
      replacementEmployeeId: leaveRequest.replacementEmployeeId,
      status: leaveRequest.status,
      createdAt: leaveRequest.createdAt,
    };
  }

  // 📊 Relation mapper - adds related data
  static mapRelations(
    this: void,
    leaveRequest: Partial<LeaveRequestWithRelations>,
  ): Partial<LeaveRequestResponseDto> {
    return {
      assignment: leaveRequest.assignment,
      absenceEmployee: leaveRequest.absenceEmployee
        ? {
            id: leaveRequest.absenceEmployee.id,
            fullName: leaveRequest.absenceEmployee.fullName,
            phoneNumber: leaveRequest.absenceEmployee.phoneNumber,
          }
        : undefined,
      replacementEmployee: leaveRequest.replacementEmployee
        ? {
            id: leaveRequest.replacementEmployee.id,
            fullName: leaveRequest.replacementEmployee.fullName,
            phoneNumber: leaveRequest.replacementEmployee.phoneNumber,
          }
        : undefined,
    };
  }

  // 🚀 Main mapper (single entry point)
  static toDto(
    this: void,
    leaveRequest: LeaveRequestWithRelations,
  ): LeaveRequestResponseDto {
    return {
      ...LeaveRequestMapper.mapBase(leaveRequest),
      ...LeaveRequestMapper.mapRelations(leaveRequest),
    } as LeaveRequestResponseDto;
  }

  // 🔁 Bulk mapper
  static toDtos(
    this: void,
    leaveRequests: LeaveRequestWithRelations[],
  ): LeaveRequestResponseDto[] {
    return leaveRequests.map((lr) => LeaveRequestMapper.toDto(lr));
  }
}
