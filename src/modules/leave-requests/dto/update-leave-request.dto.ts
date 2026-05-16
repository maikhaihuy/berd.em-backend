import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, IsEnum } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class UpdateLeaveRequestDto {
  @ApiProperty({
    description: 'Replacement employee ID',
    required: false,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  replacementEmployeeId?: number;

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
    required: false,
  })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
