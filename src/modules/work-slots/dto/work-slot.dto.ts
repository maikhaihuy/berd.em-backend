import { ApiProperty } from '@nestjs/swagger';
import { WorkSlotStatus } from '@prisma/client';

export class WorkSlotDto {
  @ApiProperty({ description: 'Work slot ID' })
  id!: number;

  @ApiProperty({ description: 'Branch ID' })
  branchId!: number;

  @ApiProperty({ description: 'Employee ID' })
  employeeId!: number;

  @ApiProperty({ description: 'Date when the work slot is assigned' })
  assignedAt!: Date;

  @ApiProperty({ description: 'Start time of the work slot' })
  startTime!: Date;

  @ApiProperty({ description: 'End time of the work slot' })
  endTime!: Date;

  @ApiProperty({
    description: 'Actual start time (when checked in)',
    nullable: true,
  })
  actualStartTime?: Date | null;

  @ApiProperty({
    description: 'Actual end time (when checked out)',
    nullable: true,
  })
  actualEndTime?: Date | null;

  @ApiProperty({ description: 'Status of the work slot', enum: WorkSlotStatus })
  status!: WorkSlotStatus;

  @ApiProperty({ description: 'Additional notes', nullable: true })
  note?: string | null;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy!: number;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy!: number;
}

export class WorkSlotLiteDto {
  @ApiProperty({ description: 'Work slot ID' })
  id!: number;

  @ApiProperty({ description: 'Branch ID' })
  branchId!: number;

  @ApiProperty({ description: 'Employee ID' })
  employeeId!: number;

  @ApiProperty({ description: 'Date when the work slot is assigned' })
  assignedAt!: Date;

  @ApiProperty({ description: 'Start time of the work slot' })
  startTime!: Date;

  @ApiProperty({ description: 'End time of the work slot' })
  endTime!: Date;

  @ApiProperty({
    description: 'Actual start time (when checked in)',
    nullable: true,
  })
  actualStartTime?: Date | null;

  @ApiProperty({
    description: 'Actual end time (when checked out)',
    nullable: true,
  })
  actualEndTime?: Date | null;

  @ApiProperty({ description: 'Status of the work slot', enum: WorkSlotStatus })
  status!: WorkSlotStatus;

  @ApiProperty({ description: 'Additional notes', nullable: true })
  note?: string | null;
}
