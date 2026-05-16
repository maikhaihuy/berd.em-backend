import { ApiProperty } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';

export class ShiftDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  branchId!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;

  @ApiProperty()
  maxSlots!: number;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiProperty()
  multiplier!: number;

  @ApiProperty()
  status!: ShiftStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class ShiftLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbreviation!: string;

  @ApiProperty()
  startTime!: Date;

  @ApiProperty()
  endTime!: Date;

  @ApiProperty()
  multiplier!: number;

  @ApiProperty()
  status!: ShiftStatus;
}
