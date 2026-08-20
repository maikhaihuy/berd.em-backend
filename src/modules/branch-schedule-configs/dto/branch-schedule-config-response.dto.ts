import { ApiProperty } from '@nestjs/swagger';

export class BranchScheduleConfigResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  branchId!: number;

  @ApiProperty()
  allowCustomAvailabilityTime!: boolean;

  @ApiProperty({ nullable: true })
  availabilityOpenDaysBefore!: number | null;

  @ApiProperty({ nullable: true })
  availabilityCloseHoursBefore!: number | null;

  @ApiProperty({ nullable: true })
  scheduleGenerationDay!: number | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
