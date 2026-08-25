import { User } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { UserWithRole, UserWithRolePermissions } from './user.types';
import { UserLiteDto } from './dto/user.dto';

export class UserMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, user: User): Omit<UserResponseDto, 'roles'> {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static mapLite(user: User): UserLiteDto {
    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  static mapRoles(
    this: void,
    user: Partial<UserWithRole>,
  ): Pick<UserResponseDto, 'roles'> {
    return {
      roles: (user.userRoles ?? []).map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(this: void, user: Partial<UserWithRole>): UserResponseDto {
    return {
      ...UserMapper.mapBase(user as User),
      ...UserMapper.mapRoles(user),
    } as UserResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(users: UserWithRole[]): UserResponseDto[] {
    return users.map(UserMapper.toDto);
  }

  // 🚀 Advanced (RBAC sâu hơn)
  static toDtoWithPermissions(user: UserWithRolePermissions): UserResponseDto {
    return {
      ...UserMapper.mapBase(user as User),
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),

      // ví dụ flatten permissions nếu cần
      // permissions: user.userRoles.flatMap(ur => ur.role.rolePermissions),
    } as UserResponseDto;
  }
}
