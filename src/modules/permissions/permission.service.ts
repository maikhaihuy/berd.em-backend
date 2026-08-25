import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { Prisma } from '@prisma/client';
import { PermissionMapper } from './permission.mapper';
import { permissionWithRolesInclude } from './permission.types';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';

const SUBJECT = 'permissions';

@Injectable()
export class PermissionsService {
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createPermissionDto: CreatePermissionDto,
    currentUserId: number,
  ): Promise<PermissionResponseDto> {
    try {
      const permission = await this.prisma.permission.create({
        data: {
          ...createPermissionDto,
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
      });

      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'create',
        subject: SUBJECT,
        entityId: permission.id,
        after: permission,
      });

      return PermissionMapper.mapBase(permission);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A permission with this action and subject already exists.',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.prisma.permission.findMany({
      include: permissionWithRolesInclude,
    });
    return PermissionMapper.toDtos(permissions);
  }

  async findOne(id: number): Promise<PermissionResponseDto> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: permissionWithRolesInclude,
    });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found.`);
    }
    return PermissionMapper.toDto(permission);
  }

  async update(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
    currentUserId: number,
  ): Promise<PermissionResponseDto> {
    const existing = await this.prisma.permission.findUnique({
      where: { id },
    });

    try {
      const permission = await this.prisma.permission.update({
        where: { id },
        data: {
          ...updatePermissionDto,
          updatedBy: currentUserId,
        },
      });

      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'update',
        subject: SUBJECT,
        entityId: id,
        before: existing,
        after: permission,
      });

      return PermissionMapper.mapBase(permission);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Permission with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number, currentUserId: number): Promise<void> {
    let deleted;
    try {
      // Note: This will cascade delete all RolePermission entries due to onDelete: Cascade
      deleted = await this.prisma.permission.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Permission with ID ${id} not found.`);
      }
      throw error;
    }

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'delete',
      subject: SUBJECT,
      entityId: id,
      before: deleted,
    });
  }
}
