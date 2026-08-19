import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubShiftType, TaskType } from '@prisma/client';

export class TaskTemplateBranchRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;
}

export class TaskTemplateMasterShiftTemplateRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

export class TaskTemplateSubShiftTemplateRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: SubShiftType })
  type!: SubShiftType;
}

export class TaskTemplateResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  branchId!: number;

  @ApiPropertyOptional()
  masterShiftTemplateId?: number | null;

  @ApiPropertyOptional()
  subShiftTemplateId?: number | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: TaskType })
  type!: TaskType;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty({ type: TaskTemplateBranchRefDto })
  branch!: TaskTemplateBranchRefDto;

  @ApiPropertyOptional({ type: TaskTemplateMasterShiftTemplateRefDto })
  masterShiftTemplate?: TaskTemplateMasterShiftTemplateRefDto | null;

  @ApiPropertyOptional({ type: TaskTemplateSubShiftTemplateRefDto })
  subShiftTemplate?: TaskTemplateSubShiftTemplateRefDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
