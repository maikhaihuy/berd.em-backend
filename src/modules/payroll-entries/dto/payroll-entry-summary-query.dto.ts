import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PayrollEntrySummaryQueryDto {
  @ApiProperty({
    description:
      "Employee to summarize. Row-scoped by the caller's ability, same as GET /payroll-entries.",
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  employeeId?: number;

  @ApiProperty({
    description:
      'Start of the workDate range (ISO 8601). Defaults to the start of the current calendar month.',
    required: false,
    example: '2026-09-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description:
      'End of the workDate range (ISO 8601). Defaults to the end of the current calendar month.',
    required: false,
    example: '2026-09-30T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
