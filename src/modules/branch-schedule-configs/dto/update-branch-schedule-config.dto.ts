import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

// branchId is the 1:1 key and is not updatable here.
export class UpdateBranchScheduleConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowCustomAvailabilityTime?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  availabilityOpenDaysBefore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  availabilityCloseHoursBefore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  scheduleGenerationDay?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
