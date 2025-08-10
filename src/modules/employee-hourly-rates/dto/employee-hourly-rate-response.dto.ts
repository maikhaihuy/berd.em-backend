import { ApiProperty } from '@nestjs/swagger';
import { EmployeeHourlyRate } from '@prisma/client';

export class EmployeeHourlyRateResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  employeeId: number;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  effectiveDate: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ required: false })
  note?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<EmployeeHourlyRate>) {
    Object.assign(this, partial);
    // Convert Prisma Decimal to number for API response
    if (this.rate && typeof this.rate !== 'number') {
      this.rate = parseFloat(this.rate as any);
    }
  }
}
