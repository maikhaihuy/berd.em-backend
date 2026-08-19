import { MasterShiftResponseDto } from './dto/master-shift-response.dto';
import { MasterShiftWithRelations } from './master-shift.types';

export class MasterShiftMapper {
  static toDto(shift: MasterShiftWithRelations): MasterShiftResponseDto {
    return {
      id: shift.id,
      branchId: shift.branchId,
      masterShiftTemplateId: shift.masterShiftTemplateId,
      workDate: shift.workDate,
      title: shift.title,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      note: shift.note,
      branch: shift.branch,
      masterShiftTemplate: shift.masterShiftTemplate,
      subShifts: shift.subShifts,
      tasks: shift.tasks,
      createdAt: shift.createdAt,
      createdBy: shift.createdBy,
      updatedAt: shift.updatedAt,
      updatedBy: shift.updatedBy,
    };
  }

  static toDtos(shifts: MasterShiftWithRelations[]): MasterShiftResponseDto[] {
    return shifts.map(MasterShiftMapper.toDto);
  }
}
