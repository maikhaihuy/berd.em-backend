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

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(
    createRoleDto: CreateRoleDto,
    currentUserId: number,
  ): Promise<RoleResponseDto> {
    const { name, permissionIds, ...rest } = createRoleDto;
    try {
      const role = await this.prisma.role.create({
        data: {
          ...rest,
          name,
          description: '',
          permissions: {
            connect: permissionIds.map((id) => ({ id })),
          },
          createdBy: currentUserId,
          updatedBy: currentUserId,
        },
        include: {
          permissions: true,
        },
      });
      return new RoleResponseDto(role);
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
      include: {
        permissions: true,
      },
    });
    return roles.map((role) => new RoleResponseDto(role));

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
      include: {
        permissions: true,
      },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found.`);
    }
    return new RoleResponseDto(role);
  }

  async update(
    id: number,
    updateRoleDto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const { permissionIds, ...rest } = updateRoleDto;
    const data: Prisma.RoleUpdateInput = { ...rest };

    if (permissionIds) {
      data.permissions = {
        set: permissionIds.map((permissionId) => ({ id: permissionId })),
      };
    }

    try {
      const role = await this.prisma.role.update({
        where: { id },
        data,
        include: {
          permissions: true,
        },
      });
      return new RoleResponseDto(role);
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

  async remove(id: number): Promise<void> {
    try {
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
