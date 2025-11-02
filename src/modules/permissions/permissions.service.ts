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

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createPermissionDto: CreatePermissionDto,
    currentUserId?: number,
  ): Promise<PermissionResponseDto> {
    try {
      const permission = await this.prisma.permission.create({
        data: {
          ...createPermissionDto,
          createdBy: currentUserId ?? 1,
          updatedBy: currentUserId ?? 1,
        },
      });
      return new PermissionResponseDto(permission);
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
    const permissions = await this.prisma.permission.findMany();
    return permissions.map(
      (permission) => new PermissionResponseDto(permission),
    );
  }

  async findOne(id: number): Promise<PermissionResponseDto> {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found.`);
    }
    return new PermissionResponseDto(permission);
  }

  async update(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
    currentUserId?: number,
  ): Promise<PermissionResponseDto> {
    try {
      const permission = await this.prisma.permission.update({
        where: { id },
        data: {
          ...updatePermissionDto,
          updatedBy: currentUserId ?? undefined,
        },
      });
      return new PermissionResponseDto(permission);
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

  async remove(id: number, currentUserId?: number): Promise<void> {
    // currentUserId available for audit/soft-delete if desired
    void currentUserId;
    try {
      await this.prisma.permission.delete({ where: { id } });
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
}
