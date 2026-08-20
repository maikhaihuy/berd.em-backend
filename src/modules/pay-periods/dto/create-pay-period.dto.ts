import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePayPeriodDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-15T23:59:59.999Z' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ required: false, example: 'First half of August' })
  @IsOptional()
  @IsString()
  notes?: string;
}
