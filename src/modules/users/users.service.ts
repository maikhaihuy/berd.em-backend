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
import { userWithBranchesInclude, userWithRoleInclude } from './user.types';
import { UserMapper } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(
    createUserDto: CreateUserDto,
    currentUserId: number,
  ): Promise<UserResponseDto> {
    const { branchIds, primaryBranchId, ...userData } = createUserDto;

    // Check if zaloId already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { zaloId: userData.zaloId },
    });
    if (existingUser) {
      throw new BadRequestException('User with this Zalo ID already exists');
    }

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

    // Verify branches if provided
    if (branchIds && branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
      });
      if (branches.length !== branchIds.length) {
        throw new BadRequestException('One or more branches do not exist');
      }

      // Validate primaryBranchId is in branchIds if provided
      if (primaryBranchId && !branchIds.includes(primaryBranchId)) {
        throw new BadRequestException(
          'Primary branch must be in the list of assigned branches',
        );
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          createdBy: currentUserId,
          updatedBy: currentUserId,
          userBranches:
            branchIds && branchIds.length > 0
              ? {
                  create: branchIds.map((branchId) => ({
                    branchId,
                    isPrimary: branchId === primaryBranchId,
                  })),
                }
              : undefined,
        },
        include: {
          ...userWithRoleInclude,
          ...userWithBranchesInclude,
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
        ...userWithBranchesInclude,
      },
    });
    return users.map((user) => UserMapper.toDto(user));
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...userWithRoleInclude,
        ...userWithBranchesInclude,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return UserMapper.toDto(user);
  }

  async findByZaloId(zaloId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { zaloId },
      include: {
        ...userWithRoleInclude,
        ...userWithBranchesInclude,
      },
    });
    return user ? UserMapper.toDto(user) : null;
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUserId: number,
  ): Promise<UserResponseDto> {
    // Verify user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    // If updating phone number, check it's not already taken
    if (
      updateUserDto.phoneNumber &&
      updateUserDto.phoneNumber !== existingUser.phoneNumber
    ) {
      const phoneExists = await this.prisma.user.findUnique({
        where: { phoneNumber: updateUserDto.phoneNumber },
      });
      if (phoneExists) {
        throw new BadRequestException('Phone number already in use');
      }
    }

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
          updatedBy: currentUserId,
        },
        include: {
          ...userWithRoleInclude,
          ...userWithBranchesInclude,
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
