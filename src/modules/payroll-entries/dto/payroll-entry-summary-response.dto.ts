import { ApiProperty } from '@nestjs/swagger';

export class PreviousPayPeriodDto {
  @ApiProperty({ example: 1 })
  payPeriodId!: number;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ example: 'FINALIZED' })
  status!: string;

  @ApiProperty({
    description: 'Sum of totalPay + bonus across this period for the employee',
    example: 1250.75,
  })
  totalPaid!: number;
}

export class PayrollEntrySummaryResponseDto {
  @ApiProperty({ example: 1 })
  employeeId!: number;

  @ApiProperty()
  from!: Date;

  @ApiProperty()
  to!: Date;

  @ApiProperty({ description: 'Sum of regular (non-overtime) pay in range' })
  shiftPay!: number;

  @ApiProperty({ description: 'Sum of approved overtime pay in range' })
  approvedOt!: number;

  @ApiProperty({ description: 'Sum of bonus amounts in range' })
  bonus!: number;

  @ApiProperty({ description: 'shiftPay + approvedOt + bonus' })
  total!: number;

  @ApiProperty({
    description:
      'Most recent FINALIZED pay period with entries for this employee, or null',
    type: PreviousPayPeriodDto,
    nullable: true,
  })
  previousPeriod!: PreviousPayPeriodDto | null;
}
