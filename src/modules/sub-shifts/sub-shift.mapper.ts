import { SubShiftResponseDto } from './dto/sub-shift-response.dto';
import { SubShiftWithRelations } from './sub-shift.types';

export class SubShiftMapper {
  static toDto(subShift: SubShiftWithRelations): SubShiftResponseDto {
    return {
      id: subShift.id,
      masterShiftId: subShift.masterShiftId,
      subShiftTemplateId: subShift.subShiftTemplateId,
      title: subShift.title,
      type: subShift.type,
      startTime: subShift.startTime,
      endTime: subShift.endTime,
      maxAssignments: subShift.maxAssignments,
      status: subShift.status,
      note: subShift.note,
      masterShift: subShift.masterShift,
      subShiftTemplate: subShift.subShiftTemplate,
      tasks: subShift.tasks,
      createdAt: subShift.createdAt,
      createdBy: subShift.createdBy,
      updatedAt: subShift.updatedAt,
      updatedBy: subShift.updatedBy,
    };
  }

  static toDtos(subShifts: SubShiftWithRelations[]): SubShiftResponseDto[] {
    return subShifts.map(SubShiftMapper.toDto);
  }
}
