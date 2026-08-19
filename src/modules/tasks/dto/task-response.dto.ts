import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  Employee,
  Task,
  TaskCompletion,
  TaskTemplate,
} from '@prisma/client';
import { TaskStatus, TaskType } from '@prisma/client';

export class TaskMasterShiftRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  workDate!: Date;
}

export class TaskSubShiftRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  masterShiftId!: number;
}

export class TaskResponseDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional()
  taskTemplateId?: number | null;

  @ApiPropertyOptional()
  masterShiftId?: number | null;

  @ApiPropertyOptional()
  subShiftId?: number | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: TaskType })
  type!: TaskType;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional()
  dueAt?: Date | null;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiPropertyOptional({ type: Object })
  taskTemplate?: TaskTemplate | null;

  @ApiPropertyOptional({ type: TaskMasterShiftRefDto })
  masterShift?: TaskMasterShiftRefDto | null;

  @ApiPropertyOptional({ type: TaskSubShiftRefDto })
  subShift?: TaskSubShiftRefDto | null;

  @ApiPropertyOptional({ type: Object })
  completion?: TaskCompletion | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class TaskCompletionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  taskId!: number;

  @ApiProperty()
  completedByEmployeeId!: number;

  @ApiProperty({ type: Object })
  task!: Task;

  @ApiProperty({ type: Object })
  completedByEmployee!: Employee;

  @ApiProperty()
  completedAt!: Date;

  @ApiPropertyOptional()
  evidence?: unknown;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
