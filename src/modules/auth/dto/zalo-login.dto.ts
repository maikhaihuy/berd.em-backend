import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ZaloLoginDto {
  @ApiProperty({
    description: 'Zalo access token from getAccessToken() on Mini App',
    example: 'zalo_access_token_here',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @ApiProperty({
    description: 'Zalo phone token from getPhoneNumber() on Mini App',
    example: 'phone_token_here',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneToken?: string;
}
