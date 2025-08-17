import { ApiProperty } from '@nestjs/swagger';
import { Schedule } from '@prisma/client';

export class ScheduleResponseDto {
  @ApiProperty({ description: 'Schedule ID' })
  id: number;

  @ApiProperty({ description: 'Shift ID' })
  shiftId: number;

  @ApiProperty({ description: 'Employee ID' })
  employeeId: number;

  @ApiProperty({ description: 'Branch ID' })
  branchId: number;

  @ApiProperty({ description: 'Start time of the schedule' })
  startTime: Date;

  @ApiProperty({ description: 'End time of the schedule' })
  endTime: Date;

  @ApiProperty({
    description: 'Optional note for the schedule',
    required: false,
  })
  note?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Shift name (optional)',
    required: false,
  })
  shiftName?: string;

  @ApiProperty({
    description: 'Employee name (optional)',
    required: false,
  })
  employeeName?: string;

  @ApiProperty({
    description: 'Branch name (optional)',
    required: false,
  })
  branchName?: string;

  @ApiProperty({
    description: 'Shift abbreviation (optional)',
    required: false,
  })
  shiftAbbreviation?: string;

  @ApiProperty({
    description: 'Branch abbreviation (optional)',
    required: false,
  })
  branchAbbreviation?: string;

  constructor(partial: Partial<Schedule>) {
    Object.assign(this, partial);
  }
}
