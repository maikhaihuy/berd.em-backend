import { ApiProperty } from '@nestjs/swagger';
import { Shift, ShiftStatus } from '@prisma/client';

export class ShiftResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  abbreviation: string;

  @ApiProperty()
  maxSlots: number;

  @ApiProperty()
  branchId: number;

  @ApiProperty()
  startTime: Date; // Time field

  @ApiProperty()
  endTime: Date; // Time field

  @ApiProperty()
  multiplier: number;

  @ApiProperty()
  status: ShiftStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Shift>) {
    Object.assign(this, partial);
  }
}
