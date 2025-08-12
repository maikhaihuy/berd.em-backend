import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';

import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { username, password, roleIds, ...rest } = createUserDto;

    // check if the username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      throw new BadRequestException('Username already exists');
    }
    // check if roleIds are not existing in the database
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    // hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...rest,
          username,
          password: hashedPassword,
          roles: {
            connect: roleIds.map((id) => ({ id })),
          },
          // createdBy and updatedBy logic needs to be handled in the service/middleware
          createdBy: 1, // Placeholder
          updatedBy: 1, // Placeholder
        },
        include: {
          roles: true,
        },
      });
      return new UserResponseDto(user);
    } catch (error) {
      // TODO: Handle specific Prisma errors
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      include: {
        roles: true,
      },
    });
    return users.map((user) => new UserResponseDto(user));
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return new UserResponseDto(user);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const { password, ...rest } = updateUserDto;

    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        include: {
          roles: true,
        },
      });
      return new UserResponseDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      throw error;
    }
  }

  async updateRoles(userId: number, roleIds: number[]) {
    // Check if the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          roles: {
            set: roleIds.map((id) => ({ id })), // Use 'set' to replace all existing roles
          },
        },
        include: {
          roles: true,
        },
      });
      return new UserResponseDto(updatedUser);
    } catch (error) {
      // Handle cases where a provided roleId does not exist
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException(
          'One or more of the provided role IDs do not exist.',
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }
      throw error;
    }
  }

  // async assignDefaultRole(userId: number) {
  //   // Find the default employee role
  //   const employeeRole = await this.prisma.role.findFirst({
  //     where: { name: 'employee' },
  //   });

  //   if (employeeRole) {
  //     await this.prisma.userRole.create({
  //       data: {
  //         userId,
  //         roleId: employeeRole.id,
  //       },
  //     });
  //   }
  // }
}
