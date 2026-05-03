import { Role } from '@prisma/client';
import { RoleResponseDto } from './dto/role-response.dto';
import { RoleDto } from './dto/role.dto';
import { RoleWithPermissions } from './role.types';
import { PermissionLiteDto } from '@modules/permissions/dto/permission.dto';

export class RoleMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, user: Role): RoleDto {
    return {
      id: user.id,
      name: user.name,
      description: user.description,
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      updatedAt: user.updatedAt,
      updatedBy: user.updatedBy,
    };
  }

  static mapPermissions(
    this: void,
    role: Partial<Role & RoleWithPermissions>,
  ): Partial<RoleResponseDto> {
    return {
      permissions: role.rolePermissions?.map(
        (rp) =>
          ({
            id: rp.permission.id,
            action: rp.permission.action,
            subject: rp.permission.subject,
          }) as PermissionLiteDto,
      ),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    role: Partial<Role & RoleWithPermissions>,
  ): RoleResponseDto {
    return {
      ...RoleMapper.mapBase(role as Role),
      ...RoleMapper.mapPermissions(role),
    } as RoleResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(roles: RoleWithPermissions[]): RoleResponseDto[] {
    return roles.map(RoleMapper.toDto);
  }
}
