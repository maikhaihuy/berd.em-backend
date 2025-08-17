import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateScheduleDto {
  @ApiProperty({
    description: 'Shift ID',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  shiftId?: number;

  @ApiProperty({
    description: 'Branch ID',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  branchId?: number;

  @ApiProperty({
    description: 'Start time of the schedule',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({
    description: 'End time of the schedule',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiProperty({
    description: 'Optional note for the schedule',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
