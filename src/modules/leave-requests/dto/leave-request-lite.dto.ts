import { ApiProperty } from '@nestjs/swagger';
import { LeaveStatus } from '@prisma/client';

export class LeaveRequestLiteDto {
  @ApiProperty({ description: 'Leave request ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Work slot ID', example: 1 })
  workSlotId: number;

  @ApiProperty({ description: 'Absence employee ID', example: 1 })
  absenceEmployeeId: number;

  @ApiProperty({ description: 'Replacement employee ID', example: 2 })
  replacementEmployeeId: number;

  @ApiProperty({
    description: 'Leave request status',
    enum: LeaveStatus,
    example: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;
}
