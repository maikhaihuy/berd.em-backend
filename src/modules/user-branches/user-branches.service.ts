import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignBranchesDto } from './dto/assign-branch.dto';
import { UpdatePrimaryBranchDto } from './dto/update-primary-branch.dto';
import { UserBranchResponseDto } from './dto/user-branch-response.dto';

@Injectable()
export class UserBranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async assignBranches(
    dto: AssignBranchesDto,
  ): Promise<UserBranchResponseDto[]> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Verify all branches exist
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: dto.branchIds } },
    });
    if (branches.length !== dto.branchIds.length) {
      throw new NotFoundException('One or more branches not found');
    }

    // If primaryBranchId is provided, verify it's in the list
    if (dto.primaryBranchId && !dto.branchIds.includes(dto.primaryBranchId)) {
      throw new BadRequestException(
        'Primary branch ID must be in the list of branch IDs',
      );
    }

    // Create user-branch assignments
    const assignments = await this.prisma.$transaction(
      dto.branchIds.map((branchId) =>
        this.prisma.userBranch.upsert({
          where: {
            userId_branchId: {
              userId: dto.userId,
              branchId,
            },
          },
          create: {
            userId: dto.userId,
            branchId,
            isPrimary: branchId === dto.primaryBranchId,
          },
          update: {
            isPrimary: branchId === dto.primaryBranchId,
          },
          include: {
            branch: {
              select: { name: true, abbreviation: true },
            },
          },
        }),
      ),
    );

    return assignments.map((assignment) => ({
      userId: assignment.userId,
      branchId: assignment.branchId,
      isPrimary: assignment.isPrimary,
      branchName: assignment.branch.name,
      branchAbbreviation: assignment.branch.abbreviation,
    }));
  }

  async getUserBranches(userId: number): Promise<UserBranchResponseDto[]> {
    const assignments = await this.prisma.userBranch.findMany({
      where: { userId },
      include: {
        branch: {
          select: { name: true, abbreviation: true },
        },
      },
    });

    return assignments.map((assignment) => ({
      userId: assignment.userId,
      branchId: assignment.branchId,
      isPrimary: assignment.isPrimary,
      branchName: assignment.branch.name,
      branchAbbreviation: assignment.branch.abbreviation,
    }));
  }

  async updatePrimaryBranch(
    userId: number,
    dto: UpdatePrimaryBranchDto,
  ): Promise<UserBranchResponseDto> {
    // Verify the user-branch assignment exists
    const assignment = await this.prisma.userBranch.findUnique({
      where: {
        userId_branchId: {
          userId,
          branchId: dto.branchId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `User ${userId} is not assigned to branch ${dto.branchId}`,
      );
    }

    // Set all branches to non-primary, then set the specified one to primary
    await this.prisma.$transaction([
      this.prisma.userBranch.updateMany({
        where: { userId },
        data: { isPrimary: false },
      }),
      this.prisma.userBranch.update({
        where: {
          userId_branchId: {
            userId,
            branchId: dto.branchId,
          },
        },
        data: { isPrimary: true },
      }),
    ]);

    const updated = await this.prisma.userBranch.findUnique({
      where: {
        userId_branchId: {
          userId,
          branchId: dto.branchId,
        },
      },
      include: {
        branch: {
          select: { name: true, abbreviation: true },
        },
      },
    });

    return {
      userId: updated!.userId,
      branchId: updated!.branchId,
      isPrimary: updated!.isPrimary,
      branchName: updated!.branch.name,
      branchAbbreviation: updated!.branch.abbreviation,
    };
  }

  async removeBranch(userId: number, branchId: number): Promise<void> {
    try {
      await this.prisma.userBranch.delete({
        where: {
          userId_branchId: { userId, branchId },
        },
      });
    } catch {
      throw new NotFoundException(
        `Branch assignment not found for user ${userId} and branch ${branchId}`,
      );
    }
  }

  async removeAllUserBranches(userId: number): Promise<void> {
    await this.prisma.userBranch.deleteMany({
      where: { userId },
    });
  }
}
