import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UpdateAvailabilityDto {
  @ApiProperty({ example: '2023-01-01T08:00:00Z', required: false })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2023-01-01T16:00:00Z', required: false })
  @IsDateString()
  endTime: string;
}
