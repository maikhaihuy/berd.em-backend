import { ApiProperty } from '@nestjs/swagger';

export class EmployeeHourlyRateDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  rate!: number;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ required: false })
  note?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class EmployeeHourlyRateLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  employeeId!: number;

  @ApiProperty()
  rate!: number;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ required: false })
  note?: string;
}
