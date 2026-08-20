import { Permission } from '@prisma/client';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { PermissionDto } from './dto/permission.dto';
import { PermissionWithRoles } from './permission.types';
import { RoleMapper } from '@modules/roles/role.mapper';

export class PermissionMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, permission: Permission): PermissionDto {
    return {
      id: permission.id,
      action: permission.action,
      subject: permission.subject,
      description: permission.description,
      createdAt: permission.createdAt,
      createdBy: permission.createdBy,
      updatedAt: permission.updatedAt,
      updatedBy: permission.updatedBy,
    };
  }

  static mapRoles(
    this: void,
    permission: Partial<Permission & PermissionWithRoles>,
  ): Partial<PermissionResponseDto> {
    return {
      roles:
        permission.rolePermissions?.map((rp) => RoleMapper.mapLite(rp.role)) ||
        [],
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    permission: Partial<Permission & PermissionWithRoles>,
  ): PermissionResponseDto {
    return {
      ...PermissionMapper.mapBase(permission as Permission),
      ...PermissionMapper.mapRoles(permission),
    } as PermissionResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(permissions: PermissionWithRoles[]): PermissionResponseDto[] {
    return permissions.map(PermissionMapper.toDto);
  }
}
