import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, SubShiftType, TaskTemplate } from '@prisma/client';

export class SubShiftTemplateBranchRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;
}

export class SubShiftTemplateMasterShiftTemplateRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

export class SubShiftTemplateResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  branchId!: number;

  @ApiProperty()
  masterShiftTemplateId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: SubShiftType })
  type!: SubShiftType;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiPropertyOptional()
  maxAssignments?: number | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty({ type: SubShiftTemplateBranchRefDto })
  branch!: SubShiftTemplateBranchRefDto;

  @ApiProperty({ type: SubShiftTemplateMasterShiftTemplateRefDto })
  masterShiftTemplate!: SubShiftTemplateMasterShiftTemplateRefDto;

  @ApiProperty({ type: [Object] })
  taskTemplates!: TaskTemplate[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
