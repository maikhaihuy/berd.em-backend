import { ApiProperty } from '@nestjs/swagger';
import { WorkSlotStatus } from '@prisma/client';

export class AssignmentResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  employeeId!: number;

  @ApiProperty({ example: 1 })
  subShiftId!: number;

  @ApiProperty({ example: 1, nullable: true })
  availabilityId!: number | null;

  @ApiProperty()
  assignedAt!: Date;

  @ApiProperty({ nullable: true })
  actualStartTime!: Date | null;

  @ApiProperty({ nullable: true })
  actualEndTime!: Date | null;

  @ApiProperty({ enum: WorkSlotStatus })
  status!: WorkSlotStatus;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty({ description: 'Employee summary', required: false })
  employee?: unknown;

  @ApiProperty({ description: 'Linked availability', required: false })
  availability?: unknown;

  @ApiProperty({
    description: 'Sub shift with master shift summary',
    required: false,
  })
  subShift?: unknown;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
