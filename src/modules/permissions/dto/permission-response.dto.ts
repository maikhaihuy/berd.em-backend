import { RoleLiteDto } from '@modules/roles/dto/role.dto';
import { ApiProperty } from '@nestjs/swagger';
import { PermissionDto } from './permission.dto';

export class PermissionResponseDto extends PermissionDto {
  @ApiProperty({ type: [Object] }) // You might want to create a separate PermissionResponseDto
  roles?: RoleLiteDto[];
}
