import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, SubShiftType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubShiftTemplateDto {
  @ApiProperty()
  @IsInt()
  branchId!: number;

  @ApiProperty()
  @IsInt()
  masterShiftTemplateId!: number;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: SubShiftType })
  @IsEnum(SubShiftType)
  type!: SubShiftType;

  @ApiProperty()
  @IsString()
  startTime!: string;

  @ApiProperty()
  @IsString()
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxAssignments?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ShiftStatus, default: ShiftStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
