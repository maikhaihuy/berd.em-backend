import {
  IsNumber,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeHourlyRateDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  employeeId: number;

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
