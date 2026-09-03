import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userWithRoleInclude } from './user.types';
import { UserMapper } from './user.mapper';
import { AuditLogsService } from '@modules/audit-logs/audit-logs.service';
import { PasswordService } from '@common/services/password.service';
import { PasswordResetTokenService } from '@modules/auth/password-reset-token.service';

const SUBJECT = 'users';
const ROLE_ASSIGNMENT_SUBJECT = 'user-roles';
const MANAGER_BRANCHES_SUBJECT = 'manager-branches';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly passwordService: PasswordService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    currentUserId: number,
  ): Promise<UserResponseDto> {
    const { roleIds, password, ...userData } = createUserDto;

    // Check if phone number already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phoneNumber: userData.phoneNumber },
    });
    if (existingPhone) {
      throw new BadRequestException(
        'User with this phone number already exists',
      );
    }

    // Verify every role exists
    await this.assertRolesExist(roleIds);

    const hashedPassword = password
      ? await this.passwordService.hash(password)
      : undefined;

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          ...(hashedPassword ? { password: hashedPassword } : {}),
          userRoles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: {
          ...userWithRoleInclude,
        },
      });

      const dto = UserMapper.toDto(user);
      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'create',
        subject: SUBJECT,
        entityId: user.id,
        after: dto as unknown as Record<string, unknown>,
      });

      return dto;
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
    currentUserId: number,
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

    const existingUserForAudit = await this.prisma.user.findUnique({
      where: { id },
      include: { ...userWithRoleInclude },
    });

    const { password, ...updateData } = updateUserDto;
    const hashedPassword = password
      ? await this.passwordService.hash(password)
      : undefined;

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          ...(hashedPassword ? { password: hashedPassword } : {}),
        },
        include: {
          ...userWithRoleInclude,
        },
      });
      const dto = UserMapper.toDto(user);
      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'update',
        subject: SUBJECT,
        entityId: id,
        before: existingUserForAudit
          ? (UserMapper.toDto(existingUserForAudit) as unknown as Record<
              string,
              unknown
            >)
          : undefined,
        after: dto as unknown as Record<string, unknown>,
      });
      return dto;
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

  async remove(id: number, currentUserId: number): Promise<void> {
    const existingUserForAudit = await this.prisma.user.findUnique({
      where: { id },
      include: { ...userWithRoleInclude },
    });

    try {
      await this.prisma.user.delete({ where: { id } });
      await this.auditLogsService.record({
        actorId: currentUserId,
        action: 'delete',
        subject: SUBJECT,
        entityId: id,
        before: existingUserForAudit
          ? (UserMapper.toDto(existingUserForAudit) as unknown as Record<
              string,
              unknown
            >)
          : undefined,
      });
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

  async generatePasswordResetToken(
    id: number,
    currentUserId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    await this.assertUserExists(id);

    const result = await this.passwordResetTokenService.issueForUser(id);

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'password-reset-token-issued',
      subject: SUBJECT,
      entityId: id,
      after: { expiresAt: result.expiresAt.toISOString() },
    });

    return result;
  }

  /**
   * Re-issues a fresh one-time credential for a User whose original
   * auto-provisioned password expired or was lost before handoff — the
   * original is never retrievable again once its initial response is gone
   * (see openspec password-account-recovery spec).
   */
  async reissueInitialPassword(
    id: number,
    currentUserId: number,
  ): Promise<{ password: string; expiresAt: Date }> {
    await this.assertUserExists(id);

    const { password, hash } =
      await this.passwordService.generateOneTimeCredential();
    const ttlDays = Number(
      this.configService.get<string>('INITIAL_PASSWORD_TTL_DAYS') ?? 7,
    );
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hash,
        mustChangePassword: true,
        mustChangePasswordExpiresAt: expiresAt,
      },
    });

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'initial-password-reissued',
      subject: SUBJECT,
      entityId: id,
      after: { mustChangePassword: true, expiresAt: expiresAt.toISOString() },
    });

    return { password, expiresAt };
  }

  async assignRoles(
    id: number,
    roleIds: number[],
    currentUserId: number,
  ): Promise<UserResponseDto> {
    await this.assertRolesExist(roleIds);

    const before = await this.findOne(id);

    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId: id, roleId })),
      skipDuplicates: true,
    });

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { ...userWithRoleInclude },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    const dto = UserMapper.toDto(user);

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'update',
      subject: ROLE_ASSIGNMENT_SUBJECT,
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: dto as unknown as Record<string, unknown>,
    });

    return dto;
  }

  async removeRole(
    id: number,
    roleId: number,
    currentUserId: number,
  ): Promise<UserResponseDto> {
    const before = await this.findOne(id);

    if (before.roles.length <= 1) {
      throw new BadRequestException(
        'Cannot remove a user’s last remaining role',
      );
    }

    try {
      await this.prisma.userRole.delete({
        where: { userId_roleId: { userId: id, roleId } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User ${id} does not hold role ${roleId}.`);
      }
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { ...userWithRoleInclude },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    const dto = UserMapper.toDto(user);

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'update',
      subject: ROLE_ASSIGNMENT_SUBJECT,
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: dto as unknown as Record<string, unknown>,
    });

    return dto;
  }

  async assignManagerBranches(
    id: number,
    branchIds: number[],
    currentUserId: number,
  ): Promise<{ userId: number; managedBranchIds: number[] }> {
    await this.assertUserExists(id);
    await this.assertBranchesExist(branchIds);

    const before = await this.getManagedBranchIds(id);

    await this.prisma.managerBranch.createMany({
      data: branchIds.map((branchId) => ({ userId: id, branchId })),
      skipDuplicates: true,
    });

    const after = await this.getManagedBranchIds(id);

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'update',
      subject: MANAGER_BRANCHES_SUBJECT,
      entityId: id,
      before: { managedBranchIds: before },
      after: { managedBranchIds: after },
    });

    return { userId: id, managedBranchIds: after };
  }

  async removeManagerBranch(
    id: number,
    branchId: number,
    currentUserId: number,
  ): Promise<{ userId: number; managedBranchIds: number[] }> {
    const before = await this.getManagedBranchIds(id);

    try {
      await this.prisma.managerBranch.delete({
        where: { userId_branchId: { userId: id, branchId } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `User ${id} does not manage branch ${branchId}.`,
        );
      }
      throw error;
    }

    const after = await this.getManagedBranchIds(id);

    await this.auditLogsService.record({
      actorId: currentUserId,
      action: 'update',
      subject: MANAGER_BRANCHES_SUBJECT,
      entityId: id,
      before: { managedBranchIds: before },
      after: { managedBranchIds: after },
    });

    return { userId: id, managedBranchIds: after };
  }

  private async getManagedBranchIds(userId: number): Promise<number[]> {
    const rows = await this.prisma.managerBranch.findMany({
      where: { userId },
    });
    return rows.map((r) => r.branchId);
  }

  private async assertUserExists(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
  }

  private async assertBranchesExist(branchIds: number[]): Promise<void> {
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
    });
    if (branches.length !== new Set(branchIds).size) {
      throw new BadRequestException('One or more branches do not exist');
    }
  }

  private async assertRolesExist(roleIds: number[]): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException('One or more roles do not exist');
    }
  }
}
