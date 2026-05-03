import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsEnum, IsOptional, IsObject } from 'class-validator';
import { AttendanceAction } from '@prisma/client';

export class CreateAttendanceHistoryDto {
  @ApiProperty({ description: 'Work slot ID', example: 1 })
  @IsInt()
  workSlotId: number;

  @ApiProperty({
    description: 'Attendance action',
    enum: AttendanceAction,
    example: AttendanceAction.CHECK_IN,
  })
  @IsEnum(AttendanceAction)
  action: AttendanceAction;

  @ApiProperty({
    description: 'Additional details (JSON)',
    required: false,
    example: { location: 'Branch A', notes: 'Early arrival' },
  })
  @IsOptional()
  @IsObject()
  detail?: Record<string, any>;
}
