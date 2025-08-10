import { IsString, IsOptional, IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShiftDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  abbreviation?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  @IsPositive()
  maxSlots?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  @IsPositive()
  branchId?: number;
}
