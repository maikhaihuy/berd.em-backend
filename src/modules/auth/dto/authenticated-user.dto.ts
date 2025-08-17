import { ApiProperty } from '@nestjs/swagger';

// this response dto is used for jwt strategy
export class AuthenticatedUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  employeeId?: number | null;

  @ApiProperty()
  roles: string[];

  constructor(partial: Partial<AuthenticatedUserDto>) {
    Object.assign(this, partial);
  }
}
