import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsDateString, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({
    description: 'Actual start time for check-in',
    example: '2026-05-01T09:05:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  actualStartTime: string;

  @ApiProperty({ description: 'ID of the user performing check-in' })
  @IsInt()
  @IsNotEmpty()
  performedBy: number;

  @ApiProperty({ description: 'Optional note for check-in', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
