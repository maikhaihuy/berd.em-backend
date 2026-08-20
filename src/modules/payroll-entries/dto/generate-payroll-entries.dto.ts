import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class GeneratePayrollEntriesDto {
  @ApiProperty({
    description: 'The pay period to generate payroll entries for',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  payPeriodId!: number;
}
