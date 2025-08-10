import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsInt,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  password: string;

  @ApiProperty({ type: [Number] })
  @IsInt({ each: true })
  @ArrayNotEmpty()
  roleIds: number[];
}
