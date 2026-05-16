import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { WorkSlotStatus } from '@prisma/client';

export class CreateWorkSlotDto {
  @ApiProperty({ description: 'Branch ID where the work slot is assigned' })
  @IsInt()
  @IsNotEmpty()
  branchId!: number;

  @ApiProperty({ description: 'Employee ID assigned to this work slot' })
  @IsInt()
  @IsNotEmpty()
  employeeId!: number;

  @ApiProperty({
    description: 'Date when the work slot is assigned',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  assignedAt!: string;

  @ApiProperty({
    description: 'Start time of the work slot',
    example: '2026-05-01T09:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'End time of the work slot',
    example: '2026-05-01T17:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({
    description: 'Status of the work slot',
    enum: WorkSlotStatus,
    default: WorkSlotStatus.SCHEDULED,
    required: false,
  })
  @IsEnum(WorkSlotStatus)
  @IsOptional()
  status?: WorkSlotStatus;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ description: 'ID of the user creating this work slot' })
  @IsInt()
  @IsNotEmpty()
  createdBy!: number;
}
