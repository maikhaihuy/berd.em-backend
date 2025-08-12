import { RoleDto } from '@modules/roles/dto/role.dto';
import { UserDto } from '@modules/users/dto/user.dto';
import { ApiProperty } from '@nestjs/swagger';

// this response dto is used for jwt strategy
export class AuthUserDto extends UserDto {
  @ApiProperty()
  roles: RoleDto[];

  constructor(partial: Partial<AuthUserDto>) {
    super(partial);
    Object.assign(this, partial);
  }
}
