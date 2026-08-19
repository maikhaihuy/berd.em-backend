import { SubShiftTemplateResponseDto } from './dto/sub-shift-template-response.dto';
import { SubShiftTemplateWithRelations } from './sub-shift-template.types';

export class SubShiftTemplateMapper {
  static toDto(
    template: SubShiftTemplateWithRelations,
  ): SubShiftTemplateResponseDto {
    return {
      id: template.id,
      branchId: template.branchId,
      masterShiftTemplateId: template.masterShiftTemplateId,
      name: template.name,
      type: template.type,
      startTime: template.startTime,
      endTime: template.endTime,
      maxAssignments: template.maxAssignments,
      sortOrder: template.sortOrder,
      status: template.status,
      note: template.note,
      branch: template.branch,
      masterShiftTemplate: template.masterShiftTemplate,
      taskTemplates: template.taskTemplates,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
      updatedAt: template.updatedAt,
      updatedBy: template.updatedBy,
    };
  }

  static toDtos(
    templates: SubShiftTemplateWithRelations[],
  ): SubShiftTemplateResponseDto[] {
    return templates.map(SubShiftTemplateMapper.toDto);
  }
}
