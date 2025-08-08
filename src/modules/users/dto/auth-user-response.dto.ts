import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';
import { RoleDto } from '../../roles/dto/role.dto';

export class AuthUserResponseDto extends UserDto {
  @ApiProperty()
  roles: RoleDto[];
}
