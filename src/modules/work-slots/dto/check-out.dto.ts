import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CheckOutDto {
  @ApiProperty({
    description: 'Actual end time for check-out',
    example: '2026-05-01T17:10:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  actualEndTime: string;

  @ApiProperty({ description: 'ID of the user performing check-out' })
  @IsInt()
  @IsNotEmpty()
  performedBy: number;

  @ApiProperty({ description: 'Optional note for check-out', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
