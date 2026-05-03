import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsDateString,
  IsDecimal,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShiftStatus } from '@prisma/client';

export class CreateShiftDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  abbreviation!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  maxSlots!: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  branchId!: number;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  endTime!: string;

  @ApiProperty()
  @IsDecimal()
  multiplier!: number;

  @ApiProperty()
  status!: ShiftStatus;
}
