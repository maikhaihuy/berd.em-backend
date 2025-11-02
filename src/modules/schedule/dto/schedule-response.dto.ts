import { ApiProperty } from '@nestjs/swagger';
import { Schedule, ScheduleStatus } from '@prisma/client';

export class ScheduleResponseDto {
  @ApiProperty({ description: 'Schedule ID' })
  id: number;

  @ApiProperty({ description: 'Shift ID' })
  shiftId: number;

  @ApiProperty({ description: 'Branch ID' })
  branchId: number;

  @ApiProperty({ description: 'Name of Schedule copy from Shift' })
  name: string;

  @ApiProperty({ description: 'Abbreviation of Schedule copy from Shift' })
  abbreviation: string;

  @ApiProperty({ description: 'MaxSlots of Schedule copy from Shift' })
  maxSlots: number;

  @ApiProperty({ description: 'Start time of the schedule' })
  workDate: Date;

  @ApiProperty({ description: 'Start time of the schedule' })
  startTime: Date;

  @ApiProperty({ description: 'End time of the schedule' })
  endTime: Date;

  @ApiProperty({
    description: 'DRAFT | PUBLISHED | LOCKED | CANCELLED | COMPLETED',
  })
  status: ScheduleStatus;

  @ApiProperty({
    description: 'Optional note for the schedule',
    required: false,
  })
  note?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  constructor(partial: Partial<Schedule>) {
    Object.assign(this, partial);
  }
}
