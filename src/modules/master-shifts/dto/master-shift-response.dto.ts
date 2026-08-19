import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, SubShift, Task, TaskCompletion } from '@prisma/client';

export class MasterShiftBranchRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;
}

export class MasterShiftTemplateRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

export type MasterShiftTaskWithCompletion = Task & {
  completion: TaskCompletion | null;
};

export class MasterShiftResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  branchId!: number;

  @ApiPropertyOptional()
  masterShiftTemplateId?: number | null;

  @ApiProperty()
  workDate!: Date;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty({ type: MasterShiftBranchRefDto })
  branch!: MasterShiftBranchRefDto;

  @ApiPropertyOptional({ type: MasterShiftTemplateRefDto })
  masterShiftTemplate?: MasterShiftTemplateRefDto | null;

  @ApiProperty({ type: [Object] })
  subShifts!: SubShift[];

  @ApiProperty({ type: [Object] })
  tasks!: MasterShiftTaskWithCompletion[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
