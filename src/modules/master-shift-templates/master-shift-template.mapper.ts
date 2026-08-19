import { MasterShiftTemplateResponseDto } from './dto/master-shift-template-response.dto';
import { MasterShiftTemplateWithRelations } from './master-shift-template.types';

export class MasterShiftTemplateMapper {
  static toDto(
    template: MasterShiftTemplateWithRelations,
  ): MasterShiftTemplateResponseDto {
    return {
      id: template.id,
      branchId: template.branchId,
      name: template.name,
      abbreviation: template.abbreviation,
      startTime: template.startTime,
      endTime: template.endTime,
      status: template.status,
      note: template.note,
      branch: template.branch,
      subShiftTemplates: template.subShiftTemplates,
      taskTemplates: template.taskTemplates,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
      updatedAt: template.updatedAt,
      updatedBy: template.updatedBy,
    };
  }

  static toDtos(
    templates: MasterShiftTemplateWithRelations[],
  ): MasterShiftTemplateResponseDto[] {
    return templates.map(MasterShiftTemplateMapper.toDto);
  }
}
