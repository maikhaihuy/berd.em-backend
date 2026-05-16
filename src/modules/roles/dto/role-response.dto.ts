import { ApiProperty } from '@nestjs/swagger';
import { PermissionLiteDto } from '@modules/permissions/dto/permission.dto';
import { RoleDto } from './role.dto';

export class RoleResponseDto extends RoleDto {
  @ApiProperty({ type: [Object] }) // You might want to create a separate PermissionResponseDto
  permissions!: PermissionLiteDto[];
}
