import { ApiProperty } from '@nestjs/swagger';
import { TimeLog, TimeLogStatus } from '@prisma/client';

export class TimeLogResponseDto {
  @ApiProperty({ description: 'Time log ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Assignment ID', example: 1 })
  assignmentId!: number;

  @ApiProperty({ description: 'Employee ID', example: 1 })
  employeeId!: number;

  @ApiProperty({
    description: 'Actual start time',
    required: false,
  })
  actualStartTime?: Date | null;

  @ApiProperty({
    description: 'Actual end time',
    required: false,
  })
  actualEndTime?: Date | null;

  @ApiProperty({
    description: 'Requested start time',
    required: false,
  })
  requestStartTime?: Date | null;

  @ApiProperty({
    description: 'Requested end time',
    required: false,
  })
  requestEndTime?: Date | null;

  @ApiProperty({
    description: 'Overtime minutes',
    required: false,
  })
  overtimeMinutes?: number | null;

  @ApiProperty({
    description: 'Pay multiplier',
    example: 1.0,
  })
  multiplier!: number;

  @ApiProperty({
    description: 'Request date',
    required: false,
  })
  requestDate?: Date | null;

  @ApiProperty({
    description: 'Reason for adjustment request',
    required: false,
  })
  requestReason?: string | null;

  @ApiProperty({
    description: 'Time log status',
    enum: TimeLogStatus,
    example: TimeLogStatus.PENDING,
  })
  status!: TimeLogStatus;

  @ApiProperty({
    description: 'Verified by employee ID',
    required: false,
  })
  verifiedBy?: number | null;

  @ApiProperty({
    description: 'Verified at timestamp',
    required: false,
  })
  verifiedAt?: Date | null;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
  })
  note?: string | null;

  constructor(partial: Partial<TimeLog>) {
    Object.assign(this, partial);
  }
}
