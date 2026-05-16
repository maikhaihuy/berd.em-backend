import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

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
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiProperty({ required: false })
  note?: string | null;
}
