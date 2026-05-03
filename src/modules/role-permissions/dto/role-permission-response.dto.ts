import { ApiProperty } from '@nestjs/swagger';

export class RolePermissionResponseDto {
  @ApiProperty({ description: 'Role ID' })
  roleId!: number;

  @ApiProperty({ description: 'Permission ID' })
  permissionId!: number;

  @ApiProperty({ description: 'Role name', required: false })
  roleName?: string;

  @ApiProperty({ description: 'Permission action', required: false })
  action?: string;

  @ApiProperty({ description: 'Permission subject', required: false })
  subject?: string;
}
