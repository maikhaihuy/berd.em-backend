import {
  TaskCompletionResponseDto,
  TaskResponseDto,
} from './dto/task-response.dto';
import { TaskCompletionWithRelations, TaskWithRelations } from './task.types';

export class TaskMapper {
  static toDto(task: TaskWithRelations): TaskResponseDto {
    return {
      id: task.id,
      taskTemplateId: task.taskTemplateId,
      masterShiftId: task.masterShiftId,
      subShiftId: task.subShiftId,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      sortOrder: task.sortOrder,
      dueAt: task.dueAt,
      note: task.note,
      taskTemplate: task.taskTemplate,
      masterShift: task.masterShift,
      subShift: task.subShift,
      completion: task.completion,
      createdAt: task.createdAt,
      createdBy: task.createdBy,
      updatedAt: task.updatedAt,
      updatedBy: task.updatedBy,
    };
  }

  static toDtos(tasks: TaskWithRelations[]): TaskResponseDto[] {
    return tasks.map(TaskMapper.toDto);
  }

  static toCompletionDto(
    completion: TaskCompletionWithRelations,
  ): TaskCompletionResponseDto {
    return {
      id: completion.id,
      taskId: completion.taskId,
      completedByEmployeeId: completion.completedByEmployeeId,
      task: completion.task,
      completedByEmployee: completion.completedByEmployee,
      completedAt: completion.completedAt,
      evidence: completion.evidence,
      note: completion.note,
      createdAt: completion.createdAt,
      createdBy: completion.createdBy,
      updatedAt: completion.updatedAt,
      updatedBy: completion.updatedBy,
    };
  }
}
