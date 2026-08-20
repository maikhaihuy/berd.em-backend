import { AttendanceHistoryResponseDto } from './dto/attendance-history-response.dto';
import { AttendanceHistoryWithRelations } from './attendance-history.types';

export class AttendanceHistoryMapper {
  static toDto(
    this: void,
    history: AttendanceHistoryWithRelations,
  ): AttendanceHistoryResponseDto {
    return {
      id: history.id,
      assignmentId: history.assignmentId,
      action: history.action,
      detail: history.detail,
      assignment: history.assignment,
      createdAt: history.createdAt,
      createdBy: history.createdBy,
    };
  }

  static toDtos(
    histories: AttendanceHistoryWithRelations[],
  ): AttendanceHistoryResponseDto[] {
    return histories.map(AttendanceHistoryMapper.toDto);
  }
}
