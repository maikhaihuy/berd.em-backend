import { Branch } from '@prisma/client';
import { BranchResponseDto } from './dto/branch-response.dto';
import { BranchDto, BranchLiteDto } from './dto/branch.dto';
import { BranchWithEmployees } from './branch.types';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';
import { EmployeeMapper } from '@modules/employees/employee.mapper';

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

  static mapLite(this: void, branch: Branch): BranchLiteDto {
    return {
      id: branch.id,
      name: branch.name,
      abbreviation: branch.abbreviation,
    };
  }

  static mapEmployees(
    this: void,
    branch: Partial<Branch & BranchWithEmployees>,
  ): Partial<BranchResponseDto> {
    return {
      employees: branch.employees?.map((employee) => EmployeeMapper.mapLite(employee)) || [],
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    branch: Partial<Branch & BranchWithEmployees>,
  ): BranchResponseDto {
    return {
      ...BranchMapper.mapBase(branch as Branch),
      ...BranchMapper.mapEmployees(branch),
    } as BranchResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(branchs: BranchWithEmployees[]): BranchResponseDto[] {
    return branchs.map(BranchMapper.toDto);
  }
}
