import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityStatus } from '@prisma/client';

export class AvailabilityDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  subShiftId!: number;

  @ApiProperty({ required: false })
  startTime?: Date | null;

  @ApiProperty({ required: false })
  endTime?: Date | null;

  @ApiProperty()
  status!: AvailabilityStatus;

  @ApiProperty({ required: false })
  note?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class AvailabilityLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  subShiftId!: number;

  @ApiProperty({ required: false })
  startTime?: Date | null;

  @ApiProperty({ required: false })
  endTime?: Date | null;

  @ApiProperty()
  status!: AvailabilityStatus;

  @ApiProperty({ required: false })
  note?: string | null;
}
