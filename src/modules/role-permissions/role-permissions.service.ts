import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AssignPermissionsDto } from './dto/assign-permission.dto';
import { RolePermissionResponseDto } from './dto/role-permission-response.dto';
import { rolePermissionInclude } from './role-permissions.types';
import { RolePermissionMapper } from './role-permissions.mapper';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

const SUBJECT = 'role-permissions';

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async assignPermissions(
    dto: AssignPermissionsDto,
    currentUserId: number,
  ): Promise<RolePermissionResponseDto[]> {
    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
    }

    // Verify all permissions exist
    const permissionIds = dto.grants.map((g) => g.permissionId);
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });
    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }

    // Create/update role-permission assignments. Additive: only the grants
    // named in the request are touched — the role's other existing grants
    // are left untouched.
    const assignments = await this.prisma.$transaction(
      dto.grants.map(({ permissionId, condition }) =>
        this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: dto.roleId,
              permissionId,
            },
          },
          create: {
            roleId: dto.roleId,
            permissionId,
            condition: condition as Prisma.InputJsonValue | undefined,
          },
          update: {
            condition: (condition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
          include: rolePermissionInclude,
        }),
      ),
    );

    for (const assignment of assignments) {
      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'create',
        subject: SUBJECT,
        entityId: assignment.permissionId,
        after: {
          roleId: assignment.roleId,
          permissionId: assignment.permissionId,
          condition: assignment.condition,
        },
      });
    }

    return RolePermissionMapper.toDtos(assignments);
  }

  async removePermission(
    roleId: number,
    permissionId: number,
    currentUserId: number,
  ): Promise<void> {
    try {
      await this.prisma.rolePermission.delete({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new NotFoundException(
        `Permission assignment not found for role ${roleId} and permission ${permissionId}`,
      );
    }

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'delete',
      subject: SUBJECT,
      entityId: permissionId,
      before: { roleId, permissionId },
    });
  }

  async getRolePermissions(
    roleId: number,
  ): Promise<RolePermissionResponseDto[]> {
    const assignments = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: rolePermissionInclude,
    });

    return RolePermissionMapper.toDtos(assignments);
  }

  async removeAllRolePermissions(
    roleId: number,
    currentUserId: number,
  ): Promise<void> {
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'delete',
      subject: SUBJECT,
      entityId: roleId,
      before: { roleId, note: 'all grants removed' },
    });
  }
}
