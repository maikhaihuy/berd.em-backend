import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionsDto } from './dto/assign-permission.dto';
import { RolePermissionResponseDto } from './dto/role-permission-response.dto';

@Injectable()
export class RolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async assignPermissions(
    dto: AssignPermissionsDto,
  ): Promise<RolePermissionResponseDto[]> {
    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });
    if (permissions.length !== dto.permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }

    // Create role-permission assignments
    const assignments = await this.prisma.$transaction(
      dto.permissionIds.map((permissionId) =>
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
          },
          update: {},
          include: {
            role: { select: { name: true } },
            permission: { select: { action: true, subject: true } },
          },
        }),
      ),
    );

    return assignments.map((assignment) => ({
      roleId: assignment.roleId,
      permissionId: assignment.permissionId,
      roleName: assignment.role.name,
      action: assignment.permission.action,
      subject: assignment.permission.subject,
    }));
  }

  async removePermission(roleId: number, permissionId: number): Promise<void> {
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
  }

  async getRolePermissions(
    roleId: number,
  ): Promise<RolePermissionResponseDto[]> {
    const assignments = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        role: { select: { name: true } },
        permission: { select: { action: true, subject: true } },
      },
    });

    return assignments.map((assignment) => ({
      roleId: assignment.roleId,
      permissionId: assignment.permissionId,
      roleName: assignment.role.name,
      action: assignment.permission.action,
      subject: assignment.permission.subject,
    }));
  }

  async removeAllRolePermissions(roleId: number): Promise<void> {
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });
  }
}
