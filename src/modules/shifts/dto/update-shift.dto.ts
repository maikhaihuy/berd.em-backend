import {
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  IsDecimal,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';

export class UpdateShiftDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  abbreviation?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  @IsPositive()
  maxSlots?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  multiplier?: string;

  @ApiProperty()
  @IsOptional()
  status?: ShiftStatus;
}
