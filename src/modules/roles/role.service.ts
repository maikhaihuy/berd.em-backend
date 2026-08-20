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

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

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
    const { permissionIds, ...roleData } = updateRoleDto;
    // const data: Prisma.RoleUpdateInput = { ...roleData };

    // Check if role name already exists
    const existingRole = await this.prisma.role.findFirst({
      where: { name: roleData.name, id: { not: id } },
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

    // Set updatedBy when currentUserId provided
    // if (typeof currentUserId === 'number') {
    //   // Prisma expects scalar values for updatedBy
    //   (data as Prisma.RoleUpdateInput & { updatedBy?: number }).updatedBy =
    //     currentUserId;
    // }

    try {
      // Update role basic fields
      const updatedRole = await this.prisma.role.update({
        where: { id },
        data: {
          ...roleData,
          updatedBy: currentUserId,
          // chỉ xử lý khi có permissionIds
          ...(permissionIds && {
            permissions: {
              set: permissionIds.map((id) => ({
                roleId_permissionId: {
                  roleId: id, // ⚠️ cần composite unique
                  permissionId: id,
                },
              })),
            },
          }),
        },
        include: roleWithPermissionsInclude,
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

  async remove(id: number, currentUserId?: number): Promise<void> {
    // currentUserId may be passed in for audit purposes. Mark as used
    // to avoid unused variable lint errors if not otherwise consumed.
    void currentUserId;

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
  }
}
