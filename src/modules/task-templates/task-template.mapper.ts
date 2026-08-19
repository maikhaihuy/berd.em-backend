import { TaskTemplateResponseDto } from './dto/task-template-response.dto';
import { TaskTemplateWithRelations } from './task-template.types';

export class TaskTemplateMapper {
  static toDto(template: TaskTemplateWithRelations): TaskTemplateResponseDto {
    return {
      id: template.id,
      branchId: template.branchId,
      masterShiftTemplateId: template.masterShiftTemplateId,
      subShiftTemplateId: template.subShiftTemplateId,
      title: template.title,
      description: template.description,
      type: template.type,
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      note: template.note,
      branch: template.branch,
      masterShiftTemplate: template.masterShiftTemplate,
      subShiftTemplate: template.subShiftTemplate,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
      updatedAt: template.updatedAt,
      updatedBy: template.updatedBy,
    };
  }

  static toDtos(
    templates: TaskTemplateWithRelations[],
  ): TaskTemplateResponseDto[] {
    return templates.map(TaskTemplateMapper.toDto);
  }
}
