import { ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ example: '2023-01-01T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2023-01-01T16:00:00Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status?: AvailabilityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
