import { ApiProperty } from '@nestjs/swagger';
import { Availability } from '@prisma/client';

export class AvailabilityResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  employeeId: number;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  startTime: Date;

  @ApiProperty()
  endTime: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Availability>) {
    Object.assign(this, partial);
  }
}
