import { ApiProperty } from '@nestjs/swagger';
import { PayPeriodStatus } from '@prisma/client';

export class PayPeriodResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ enum: PayPeriodStatus })
  status!: PayPeriodStatus;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}
