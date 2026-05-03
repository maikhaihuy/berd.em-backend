import { Branch } from '@prisma/client';
import { BranchResponseDto } from './dto/branch-response.dto';
import { BranchDto } from './dto/branch.dto';
import { BranchWithUsers } from './branch.types';
import { UserLiteDto } from '@modules/users/dto/user.dto';

export class BranchMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, branch: Branch): BranchDto {
    return {
      id: branch.id,
      name: branch.name,
      abbreviation: branch.abbreviation,
      address: branch.address,
      phone: branch.phone ?? undefined,
      email: branch.email ?? undefined,
      createdAt: branch.createdAt,
      createdBy: branch.createdBy,
      updatedAt: branch.updatedAt,
      updatedBy: branch.updatedBy,
    };
  }

  static mapUsers(
    this: void,
    branch: Partial<Branch & BranchWithUsers>,
  ): Partial<BranchResponseDto> {
    return {
      users: branch.userBranches?.map(
        (rp) =>
          ({
            id: rp.user.id,
            fullName: rp.user.fullName,
            avatarUrl: rp.user.avatarUrl,
          }) as UserLiteDto,
      ),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    branch: Partial<Branch & BranchWithUsers>,
  ): BranchResponseDto {
    return {
      ...BranchMapper.mapBase(branch as Branch),
      ...BranchMapper.mapUsers(branch),
    } as BranchResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(branchs: BranchWithUsers[]): BranchResponseDto[] {
    return branchs.map(BranchMapper.toDto);
  }
}
