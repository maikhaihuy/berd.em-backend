import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { LeaveStatus } from '@prisma/client';

export class LeaveRequestDto {
  @ApiProperty({ description: 'Leave request ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Assignment ID', example: 1 })
  assignmentId!: number;

  @ApiProperty({ description: 'Absence employee ID', example: 1 })
  absenceEmployeeId!: number;

  @ApiProperty({ description: 'Replacement employee ID', example: 2 })
  replacementEmployeeId!: number;

  @ApiProperty({ description: 'Approved by user ID', required: false })
  approvedId?: number | null;

  @ApiProperty({
    description: 'Reason for leave',
    required: false,
    example: 'Family emergency',
  })
  reason?: string | null;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Approved - replacement confirmed',
  })
  note?: string | null;

  @ApiProperty({
    description: 'Leave request status',
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
  })
  status!: LeaveStatus;

  @ApiProperty({ description: 'Approved at timestamp', required: false })
  approvedAt?: Date | null;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @Exclude()
  @ApiProperty({ description: 'Created by user ID' })
  createdBy!: number;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;

  @Exclude()
  @ApiProperty({ description: 'Updated by user ID' })
  updatedBy!: number;
}

export class LeaveRequestLiteDto {
  @ApiProperty({ description: 'Leave request ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Assignment ID', example: 1 })
  assignmentId!: number;

  @ApiProperty({ description: 'Absence employee ID', example: 1 })
  absenceEmployeeId!: number;

  @ApiProperty({ description: 'Replacement employee ID', example: 2 })
  replacementEmployeeId!: number;

  @ApiProperty({ description: 'Approved by user ID', required: false })
  approvedId?: number | null;

  @ApiProperty({
    description: 'Reason for leave',
    required: false,
    example: 'Family emergency',
  })
  reason?: string | null;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Approved - replacement confirmed',
  })
  note?: string | null;

  @ApiProperty({
    description: 'Leave request status',
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
  })
  status!: LeaveStatus;

  @ApiProperty({ description: 'Approved at timestamp', required: false })
  approvedAt?: Date | null;
}
