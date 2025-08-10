import { ApiProperty } from '@nestjs/swagger';
import { Shift } from '@prisma/client';

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
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Shift>) {
    Object.assign(this, partial);
  }
}
