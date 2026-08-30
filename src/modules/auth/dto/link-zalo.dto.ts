import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LinkZaloDto {
  @ApiProperty({
    description: 'Zalo access token from getAccessToken() on Mini App',
    example: 'zalo_access_token_here',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
