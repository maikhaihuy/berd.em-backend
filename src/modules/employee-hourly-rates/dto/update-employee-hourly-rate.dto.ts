import {
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeHourlyRateDto {
  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  employeeId?: number;

  @ApiProperty({ type: Number, required: false })
  @IsNumber()
  @IsOptional()
  rate?: number;

  @ApiProperty({ type: String, format: 'date', required: false })
  @IsDateString()
  @IsOptional()
  effectiveDate?: Date;

  @ApiProperty({ type: String, format: 'date', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
