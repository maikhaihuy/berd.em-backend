import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, IsEnum } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Assignment ID', example: 1 })
  @IsInt()
  assignmentId: number;

  @ApiProperty({ description: 'Employee requesting leave ID', example: 1 })
  @IsInt()
  absenceEmployeeId: number;

  @ApiProperty({ description: 'Replacement employee ID', example: 2 })
  @IsInt()
  replacementEmployeeId: number;

  @ApiProperty({
    description: 'Reason for leave',
    required: false,
    example: 'Family emergency',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Will return next week',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Leave request status',
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
    default: LeaveStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
