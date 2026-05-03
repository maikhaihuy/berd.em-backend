import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class ApproveLeaveRequestDto {
  @ApiProperty({
    description: 'Approval decision',
    enum: LeaveStatus,
    example: 'APPROVED',
  })
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @ApiProperty({
    description: 'Optional note for the decision',
    required: false,
    example: 'Approved - replacement confirmed',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
