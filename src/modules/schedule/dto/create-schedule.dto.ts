import { ApiProperty } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';
import {
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Shift ID' })
  @IsInt()
  @IsPositive()
  shiftId: number;

  @ApiProperty({ description: 'Branch ID' })
  @IsInt()
  @IsPositive()
  branchId: number;

  @ApiProperty({ description: 'Date of the schedule' })
  @IsDateString()
  workDate: string;

  @ApiProperty({ description: 'Start time of the schedule' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'End time of the schedule' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ description: 'Status of the schedule' })
  status: ScheduleStatus;

  @ApiProperty({
    description: 'Optional note for the schedule',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
