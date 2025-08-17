import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsDateString,
  IsString,
} from 'class-validator';

export class UpsertEmployeeHourlyRateDto {
  @ApiProperty({
    required: false,
    description: 'ID is required for updates, but optional for new records',
  })
  @IsInt()
  @IsOptional()
  id?: number;

  @ApiProperty({
    type: Number,
    description: 'Hourly rate with up to 2 decimal places',
  })
  @IsNumber()
  @IsNotEmpty()
  rate: number;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString()
  @IsNotEmpty()
  effectiveDate: Date;

  @ApiProperty({ type: String, format: 'date', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
