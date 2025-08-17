import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsPositive } from 'class-validator';

export class CreateAvailabilityDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsInt()
  @IsPositive()
  employeeId: number;

  @ApiProperty({ example: '2023-01-01T08:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2023-01-01T16:00:00Z' })
  @IsDateString()
  endTime: string;
}
