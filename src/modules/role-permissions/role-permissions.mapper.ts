import { RolePermissionResponseDto } from './dto/role-permission-response.dto';
import { RolePermissionWithRelations } from './role-permissions.types';

export class RolePermissionMapper {
  static toDto(
    this: void,
    assignment: RolePermissionWithRelations,
  ): RolePermissionResponseDto {
    return {
      roleId: assignment.roleId,
      permissionId: assignment.permissionId,
      roleName: assignment.role.name,
      action: assignment.permission.action,
      subject: assignment.permission.subject,
      condition: assignment.condition as Record<string, unknown> | null,
    };
  }

  static toDtos(
    assignments: RolePermissionWithRelations[],
  ): RolePermissionResponseDto[] {
    return assignments.map(RolePermissionMapper.toDto);
  }
}
