import {
  IsString,
  IsOptional,
  IsEmail,
  IsInt,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  probationStartDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  officialStartDate?: string;

  @ApiProperty({ type: [Number], required: false })
  @IsInt({ each: true })
  @IsOptional()
  @ArrayNotEmpty()
  branchIds?: number[];
}
