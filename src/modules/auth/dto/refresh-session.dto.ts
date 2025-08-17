import { ApiProperty } from '@nestjs/swagger';
import { AuthenticatedUserDto } from './authenticated-user.dto';

export class RefreshSessionDto extends AuthenticatedUserDto {
  @ApiProperty()
  tokenId: string;

  constructor(partial: Partial<RefreshSessionDto>) {
    super(partial);
    Object.assign(this, partial);
  }
}
