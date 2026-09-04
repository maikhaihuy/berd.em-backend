import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdatePayrollEntryBonusDto {
  @ApiProperty({
    description: 'The new bonus amount for this payroll entry',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  bonus!: number;
}
