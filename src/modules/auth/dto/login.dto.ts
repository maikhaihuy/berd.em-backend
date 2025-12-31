import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'settings' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'ChangeMe!123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
