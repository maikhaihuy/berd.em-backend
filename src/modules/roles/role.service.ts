import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { RoleResponseDto } from './dto/role-response.dto';
import { Prisma } from '@prisma/client';
import { roleWithPermissionsInclude } from './role.types';
import { RoleMapper } from './role.mapper';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

const SUBJECT = 'roles';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createRoleDto: CreateRoleDto,
    currentUserId: number,
  ): Promise<RoleResponseDto> {
    const { permissionIds, ...roleData } = createRoleDto;

    // Check if role name already exists
    const existingRole = await this.prisma.role.findUnique({
      where: { name: roleData.name },
    });
    if (existingRole) {
      throw new BadRequestException('Role with this name already exists');
    }

    // Verify permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: { id: { in: permissionIds } },
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more branches do not exist');
      }
    }

    try {
      const role = await this.prisma.role.create({
        data: {
          ...roleData,
          rolePermissions: {
            create: permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: roleWithPermissionsInclude,
      });

      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'create',
        subject: SUBJECT,
        entityId: role.id,
        after: role,
      });

      return RoleMapper.toDto(role);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Role name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    // const skip = (page - 1) * limit;
    // const totalCount = await this.prisma.role.count();
    // const roles = await this.prisma.role.findMany({
    //   skip,
    //   take: limit,
    //   include: {
    //     permissions: true,
    //   },
    // });

    const roles = await this.prisma.role.findMany({
      // skip,
      // take: limit,
      include: roleWithPermissionsInclude,
    });
    return RoleMapper.toDtos(roles);

    // return {
    //   data: roleResponseDtos,
    //   meta: {
    //     totalItems: totalCount,
    //     itemCount: roles.length,
    //     itemsPerPage: limit,
    //     totalPages: Math.ceil(totalCount / limit),
    //     currentPage: page,
    //   },
    // };
  }

  async findOne(id: number): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleWithPermissionsInclude,
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found.`);
    }
    return RoleMapper.toDto(role);
  }

  async update(
    id: number,
    updateRoleDto: UpdateRoleDto,
    currentUserId: number,
  ): Promise<RoleResponseDto> {
    const existingRoleForAudit = await this.prisma.role.findUnique({
      where: { id },
    });

    // Check if role name already exists — only when name is actually being
    // changed. `where: { name: undefined }` is dropped by Prisma (no filter
    // on that field), so running this unconditionally would match the first
    // *other* role in the table and false-positive on every update that
    // doesn't touch `name` at all.
    if (updateRoleDto.name !== undefined) {
      const existingRole = await this.prisma.role.findFirst({
        where: { name: updateRoleDto.name, id: { not: id } },
      });
      if (existingRole) {
        throw new BadRequestException('Role with this name already exists');
      }
    }

    try {
      const updatedRole = await this.prisma.role.update({
        where: { id },
        data: {
          ...updateRoleDto,
          updatedBy: currentUserId,
        },
        include: roleWithPermissionsInclude,
      });

      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'update',
        subject: SUBJECT,
        entityId: id,
        before: existingRoleForAudit as unknown as Record<string, unknown>,
        after: updatedRole,
      });

      return RoleMapper.toDto(updatedRole);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Role with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found.`);
    }
    if (role.isSystemRole) {
      throw new BadRequestException(
        'System roles (Admin, Manager, Employee) cannot be deleted',
      );
    }

    try {
      // If you want to keep an audit trail instead of hard delete,
      // implement soft-delete here. For now we perform hard delete.
      // Note: rolePermissions will be automatically deleted due to onDelete: Cascade
      await this.prisma.role.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Role with ID ${id} not found.`);
      }
      throw error;
    }

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'delete',
      subject: SUBJECT,
      entityId: id,
      before: role,
    });
  }
}
