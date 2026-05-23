import { ApiProperty } from '@nestjs/swagger';
import { AttendanceAction, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';

class EmployeeDetailsDto {
  @ApiProperty({ description: 'Employee ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Employee full name', example: 'John Doe' })
  fullName!: string;
}

class BranchDetailsDto {
  @ApiProperty({ description: 'Branch ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Branch name', example: 'Main Office' })
  name!: string;
}

class WorkSlotDetailsDto {
  @ApiProperty({ description: 'Work slot ID', example: 1 })
  id!: number;

  @ApiProperty({ type: EmployeeDetailsDto, description: 'Associated employee' })
  @Type(() => EmployeeDetailsDto)
  employee!: EmployeeDetailsDto;

  @ApiProperty({ type: BranchDetailsDto, description: 'Associated branch' })
  @Type(() => BranchDetailsDto)
  branch!: BranchDetailsDto;
}

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
  workSlotId!: number;

  @ApiProperty({
    description: 'Attendance action (check-in, check-out, break-start, break-end)',
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
    type: WorkSlotDetailsDto,
    description: 'Associated work slot with employee and branch information',
    required: false,
  })
  @Type(() => WorkSlotDetailsDto)
  workSlot?: WorkSlotDetailsDto;

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
