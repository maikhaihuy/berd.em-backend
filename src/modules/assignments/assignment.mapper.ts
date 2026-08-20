import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { AssignmentWithRelations } from './assignment.types';

export class AssignmentMapper {
  static toDto(
    this: void,
    assignment: AssignmentWithRelations,
  ): AssignmentResponseDto {
    return {
      id: assignment.id,
      employeeId: assignment.employeeId,
      subShiftId: assignment.subShiftId,
      availabilityId: assignment.availabilityId,
      assignedAt: assignment.assignedAt,
      actualStartTime: assignment.actualStartTime,
      actualEndTime: assignment.actualEndTime,
      status: assignment.status,
      note: assignment.note,
      employee: assignment.employee,
      availability: assignment.availability,
      subShift: assignment.subShift,
      createdAt: assignment.createdAt,
      createdBy: assignment.createdBy,
      updatedAt: assignment.updatedAt,
      updatedBy: assignment.updatedBy,
    };
  }

  static toDtos(
    assignments: AssignmentWithRelations[],
  ): AssignmentResponseDto[] {
    return assignments.map(AssignmentMapper.toDto);
  }
}
