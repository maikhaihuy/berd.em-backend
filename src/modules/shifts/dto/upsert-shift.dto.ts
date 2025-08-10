import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsPositive,
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
}
