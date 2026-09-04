import { ApiProperty } from '@nestjs/swagger';

export class PayrollEntryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  timeLogId!: number;

  @ApiProperty({ example: 1 })
  employeeId!: number;

  @ApiProperty({ example: 1 })
  payPeriodId!: number;

  @ApiProperty()
  payDate!: Date;

  @ApiProperty()
  workDate!: Date;

  @ApiProperty()
  calculatedAt!: Date;

  @ApiProperty()
  calculatedBy!: number;

  @ApiProperty({ description: 'Computed total pay', example: 240.5 })
  totalPay!: number;

  @ApiProperty({
    description:
      'Discretionary bonus, set via PATCH /payroll-entries/:id/bonus',
    example: 0,
  })
  bonus!: number;

  @ApiProperty({ description: 'Source time log', required: false })
  timeLog?: unknown;

  @ApiProperty({ description: 'Employee summary', required: false })
  employee?: unknown;

  @ApiProperty({ description: 'Pay period summary', required: false })
  payPeriod?: unknown;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class SkippedTimeLogDto {
  @ApiProperty({ example: 5 })
  timeLogId!: number;

  @ApiProperty({ example: 'No applicable hourly rate for work date' })
  reason!: string;
}

export class GeneratePayrollEntriesResultDto {
  @ApiProperty({ type: [PayrollEntryResponseDto] })
  created!: PayrollEntryResponseDto[];

  @ApiProperty({ type: [SkippedTimeLogDto] })
  skipped!: SkippedTimeLogDto[];
}
