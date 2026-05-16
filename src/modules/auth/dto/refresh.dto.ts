import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'The refresh token used to obtain a new access token',
    required: true,
    type: String,
    format: 'string',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
