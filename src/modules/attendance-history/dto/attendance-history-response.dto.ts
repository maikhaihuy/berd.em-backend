import { ApiProperty } from '@nestjs/swagger';
import { AttendanceAction, Prisma } from '@prisma/client';

export class AttendanceHistoryResponseDto {
  @ApiProperty({ description: 'Attendance history ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Work slot ID', example: 1 })
  workSlotId: number;

  @ApiProperty({
    description: 'Attendance action',
    enum: AttendanceAction,
    example: AttendanceAction.CHECK_IN,
  })
  action: AttendanceAction;

  @ApiProperty({
    description: 'Additional details (JSON)',
    required: false,
    example: { location: 'Branch A', notes: 'Early arrival' },
  })
  detail?: Prisma.JsonValue;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy: number;

  constructor(partial: Partial<AttendanceHistoryResponseDto>) {
    Object.assign(this, partial);
  }
}
