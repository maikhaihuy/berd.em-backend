import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  IsDateString,
  IsArray,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDto {
  // User fields
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  // Employee fields
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '1990-01-01', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ example: '2024-01-01', required: false })
  @IsDateString()
  @IsOptional()
  probationStartDate?: string;

  @ApiProperty({ example: '2024-03-01', required: false })
  @IsDateString()
  @IsOptional()
  officialStartDate?: string;

  @ApiProperty({ example: [1, 2], description: 'Array of role IDs' })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  roleIds: number[];

  @ApiProperty({
    example: [1, 2],
    description: 'Array of branch IDs',
    required: false,
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  branchIds?: number[];
}
