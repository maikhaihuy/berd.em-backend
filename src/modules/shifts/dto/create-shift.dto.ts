import { IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShiftDto {
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

  @ApiProperty()
  @IsInt()
  @IsPositive()
  branchId: number;
}
