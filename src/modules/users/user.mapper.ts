import { User } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import {
  UserWithBranches,
  UserWithRole,
  UserWithRolePermissions,
} from './user.types';

export class UserMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, user: User): UserResponseDto {
    return {
      id: user.id,
      zaloId: user.zaloId,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roleId: user.roleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static mapRole(
    this: void,
    user: Partial<UserWithRole>,
  ): Partial<UserResponseDto> {
    return {
      roleName: user.role?.name, // safe access
    };
  }

  static mapBranches(
    this: void,
    user: Partial<UserWithBranches>,
  ): Partial<UserResponseDto> {
    return {
      branches: user.userBranches?.map((ub) => ({
        branchId: ub.branchId,
        branchName: ub.branch.name,
        isPrimary: ub.isPrimary,
      })),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    user: Partial<UserWithRole & UserWithBranches>,
  ): UserResponseDto {
    return {
      ...UserMapper.mapBase(user as User),
      ...UserMapper.mapRole(user),
      ...UserMapper.mapBranches(user),
    } as UserResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(users: UserWithRole[]): UserResponseDto[] {
    return users.map(UserMapper.toDto);
  }

  // 🚀 Advanced (RBAC sâu hơn)
  static toDtoWithPermissions(user: UserWithRolePermissions): UserResponseDto {
    return {
      id: user.id,
      zaloId: user.zaloId,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roleId: user.roleId,
      roleName: user.role?.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,

      // ví dụ flatten permissions nếu cần
      // permissions: user.role?.permissions?.map(p => p.name),
    };
  }
}
