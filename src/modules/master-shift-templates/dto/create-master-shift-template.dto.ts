import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMasterShiftTemplateDto {
  @ApiProperty()
  @IsInt()
  branchId!: number;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  abbreviation?: string;

  @ApiProperty({ description: 'Time string accepted by Date constructor' })
  @IsString()
  startTime!: string;

  @ApiProperty({ description: 'Time string accepted by Date constructor' })
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
