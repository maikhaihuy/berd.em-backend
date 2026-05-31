import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMasterShiftDto {
  @ApiProperty()
  @IsInt()
  branchId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  masterShiftTemplateId?: number;

  @ApiProperty()
  @IsString()
  workDate!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  startTime!: string;

  @ApiProperty()
  @IsString()
  endTime!: string;

  @ApiPropertyOptional({ enum: ShiftStatus, default: ShiftStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
