import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsDateString,
  IsString,
  IsEnum,
} from 'class-validator';
import { WorkSlotStatus } from '@prisma/client';

export class UpdateWorkSlotDto {
  @ApiProperty({ description: 'Branch ID', required: false })
  @IsInt()
  @IsOptional()
  branchId?: number;

  @ApiProperty({ description: 'Employee ID', required: false })
  @IsInt()
  @IsOptional()
  employeeId?: number;

  @ApiProperty({
    description: 'Date when the work slot is assigned',
    example: '2026-05-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  assignedAt?: string;

  @ApiProperty({
    description: 'Start time of the work slot',
    example: '2026-05-01T09:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({
    description: 'End time of the work slot',
    example: '2026-05-01T17:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({
    description: 'Actual start time (for check-in)',
    example: '2026-05-01T09:05:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  actualStartTime?: string;

  @ApiProperty({
    description: 'Actual end time (for check-out)',
    example: '2026-05-01T17:10:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  actualEndTime?: string;

  @ApiProperty({
    description: 'Status of the work slot',
    enum: WorkSlotStatus,
    required: false,
  })
  @IsEnum(WorkSlotStatus)
  @IsOptional()
  status?: WorkSlotStatus;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ description: 'ID of the user updating this work slot' })
  @IsInt()
  @IsOptional()
  updatedBy?: number;
}
