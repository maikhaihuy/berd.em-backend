import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userWithRoleInclude } from './user.types';
import { UserMapper } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { ...userData } = createUserDto;

    // Check if phone number already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phoneNumber: userData.phoneNumber },
    });
    if (existingPhone) {
      throw new BadRequestException(
        'User with this phone number already exists',
      );
    }

    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: userData.roleId },
    });
    if (!role) {
      throw new BadRequestException('Role does not exist');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          // userBranches:
          //   branchIds && branchIds.length > 0
          //     ? {
          //         create: branchIds.map((branchId) => ({
          //           branchId,
          //           isPrimary: branchId === primaryBranchId,
          //         })),
          //       }
          //     : undefined,
        },
        include: {
          ...userWithRoleInclude,
        },
      });

      return UserMapper.toDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'User with these credentials already exists',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      include: {
        ...userWithRoleInclude,
      },
    });
    return users.map((user) => UserMapper.toDto(user));
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...userWithRoleInclude,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return UserMapper.toDto(user);
  }

  async findByZaloUserId(zaloUserId: string): Promise<UserResponseDto | null> {
    const zaloIdentity = await this.prisma.zaloIdentity.findUnique({
      where: { zaloUserId },
      include: {
        user: {
          include: {
            ...userWithRoleInclude,
          },
        },
      },
    });

    const user = zaloIdentity?.user;
    return user ? UserMapper.toDto(user) : null;
  }

  async findByZaloId(zaloUserId: string): Promise<UserResponseDto | null> {
    return this.findByZaloUserId(zaloUserId);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // // Verify user exists
    // const existingUser = await this.prisma.user.findUnique({
    //   where: { id },
    // });
    // if (!existingUser) {
    //   throw new NotFoundException(`User with ID ${id} not found.`);
    // }

    // // If updating phone number, check it's not already taken
    // if (
    //   updateUserDto.phoneNumber &&
    //   updateUserDto.phoneNumber !== existingUser.phoneNumber
    // ) {
    //   const phoneExists = await this.prisma.user.findUnique({
    //     where: { phoneNumber: updateUserDto.phoneNumber },
    //   });
    //   if (phoneExists) {
    //     throw new BadRequestException('Phone number already in use');
    //   }
    // }

    // If updating role, verify it exists
    if (updateUserDto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: updateUserDto.roleId },
      });
      if (!role) {
        throw new BadRequestException('Role does not exist');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateUserDto,
        },
        include: {
          ...userWithRoleInclude,
        },
      });
      return UserMapper.toDto(user);
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
}
