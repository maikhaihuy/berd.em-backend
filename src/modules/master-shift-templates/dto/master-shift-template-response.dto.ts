import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShiftStatus,
  SubShiftTemplate,
  TaskTemplate,
} from '@prisma/client';

export class MasterShiftTemplateBranchRefDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;
}

export class MasterShiftTemplateResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  branchId!: number;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  abbreviation?: string | null;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiProperty({ enum: ShiftStatus })
  status!: ShiftStatus;

  @ApiPropertyOptional()
  note?: string | null;

  @ApiProperty({ type: MasterShiftTemplateBranchRefDto })
  branch!: MasterShiftTemplateBranchRefDto;

  @ApiProperty({ type: [Object] })
  subShiftTemplates!: SubShiftTemplate[];

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
