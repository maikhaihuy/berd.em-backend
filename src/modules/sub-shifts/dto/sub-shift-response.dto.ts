import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, SubShiftType, Task, TaskCompletion } from '@prisma/client';

export class SubShiftMasterShiftRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  branchId!: number;

  @ApiProperty()
  workDate!: Date;
}

export class SubShiftTemplateRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: SubShiftType })
  type!: SubShiftType;
}

export type SubShiftTaskWithCompletion = Task & {
  completion: TaskCompletion | null;
};

export class SubShiftResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  masterShiftId!: number;

  @ApiPropertyOptional()
  subShiftTemplateId?: number | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: SubShiftType })
  type!: SubShiftType;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiPropertyOptional()
  maxAssignments?: number | null;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty({ type: SubShiftMasterShiftRefDto })
  masterShift!: SubShiftMasterShiftRefDto;

  @ApiPropertyOptional({ type: SubShiftTemplateRefDto })
  subShiftTemplate?: SubShiftTemplateRefDto | null;

  @ApiProperty({ type: [Object] })
  tasks!: SubShiftTaskWithCompletion[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
