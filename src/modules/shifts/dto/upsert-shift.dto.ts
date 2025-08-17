import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsPositive,
  IsDecimal,
  IsDateString,
} from 'class-validator';

export class UpsertShiftDto {
  @ApiProperty({
    required: false,
    description: 'ID is required for updates, but optional for new shifts',
  })
  @IsInt()
  @IsOptional()
  id?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  abbreviation: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  maxSlots: number;

  @ApiProperty({ example: '2023-01-01T08:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2023-01-01T16:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ example: '1.0' })
  @IsDecimal()
  multiplier: string;
}
