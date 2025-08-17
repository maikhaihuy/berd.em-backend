import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  ArrayNotEmpty,
  IsInt,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: '1990-01-01', required: false })
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ example: '2023-01-01', required: false })
  @IsOptional()
  probationStartDate?: string;

  @ApiProperty({ example: '2023-06-01', required: false })
  @IsOptional()
  officialStartDate?: string;

  @ApiProperty({
    type: [Number],
    description: 'An array of branch IDs to which the employee is assigned.',
  })
  @IsInt({ each: true })
  @ArrayNotEmpty()
  branchIds: number[];
}
