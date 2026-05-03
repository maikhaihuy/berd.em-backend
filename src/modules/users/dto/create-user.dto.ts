import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsUrl,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Zalo unique identifier', example: 'zalo_12345' })
  @IsString()
  @IsNotEmpty()
  zaloId!: string;

  @ApiProperty({ description: 'User phone number', example: '+84901234567' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ description: 'User full name', example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiProperty({ description: 'Role ID', example: 1 })
  @IsInt()
  roleId!: number;

  @ApiProperty({
    description: 'Branch IDs to assign to user',
    type: [Number],
    example: [1, 2],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  branchIds?: number[];

  @ApiProperty({
    description: 'Primary branch ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  primaryBranchId?: number;
}
