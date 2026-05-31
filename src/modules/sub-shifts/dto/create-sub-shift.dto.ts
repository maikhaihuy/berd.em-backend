import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus, SubShiftType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateSubShiftDto {
  @ApiProperty()
  @IsInt()
  masterShiftId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  subShiftTemplateId?: number;

  @ApiProperty()
  @IsString()
  title!: string;

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

  @ApiPropertyOptional({ enum: ShiftStatus, default: ShiftStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
