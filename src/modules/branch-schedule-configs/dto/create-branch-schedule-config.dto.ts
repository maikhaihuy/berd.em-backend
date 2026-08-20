import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateBranchScheduleConfigDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  branchId!: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowCustomAvailabilityTime?: boolean;

  @ApiProperty({ required: false, example: 7 })
  @IsOptional()
  @IsInt()
  availabilityOpenDaysBefore?: number;

  @ApiProperty({ required: false, example: 12 })
  @IsOptional()
  @IsInt()
  availabilityCloseHoursBefore?: number;

  @ApiProperty({ required: false, example: 25 })
  @IsOptional()
  @IsInt()
  scheduleGenerationDay?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
