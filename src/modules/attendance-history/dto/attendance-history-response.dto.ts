import { ApiProperty } from '@nestjs/swagger';
import { AttendanceAction, Prisma } from '@prisma/client';

export class AttendanceHistoryResponseDto {
  @ApiProperty({
    description: 'Attendance history ID',
    example: 1,
  })
  id!: number;

  @ApiProperty({
    description: 'Work slot ID',
    example: 1,
  })
  assignmentId!: number;

  @ApiProperty({
    description:
      'Attendance action (check-in, check-out, break-start, break-end)',
    enum: AttendanceAction,
    example: AttendanceAction.CHECK_IN,
  })
  action!: AttendanceAction;

  @ApiProperty({
    description: 'Additional JSON details (location, notes, etc.)',
    required: false,
    example: { location: 'Branch A', notes: 'Early arrival' },
  })
  detail?: Prisma.JsonValue;

  @ApiProperty({
    description: 'Associated assignment with employee and branch information',
    required: false,
  })
  assignment?: unknown;

  @ApiProperty({
    description: 'Timestamp when record was created',
    example: '2026-05-17T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'User ID who created this record',
    example: 1,
  })
  createdBy!: number;

  constructor(partial: Partial<AttendanceHistoryResponseDto>) {
    Object.assign(this, partial);
  }
}
