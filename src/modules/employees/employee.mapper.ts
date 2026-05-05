import { Employee } from '@prisma/client';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { EmployeeWithBranches } from './employee.types';
import { UserMapper } from '@modules/users/user.mapper';
import { BranchMapper } from '@modules/branches/branch.mapper';

export class EmployeeMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, employee: Employee): EmployeeResponseDto {
    return {
      id: employee.id,
      fullName: employee.fullName,
      phoneNumber: employee.phoneNumber,
      avatar: employee.avatar,
      dateOfBirth: employee.dateOfBirth,
      email: employee.email,
      address: employee.address,
      probationStartDate: employee.probationStartDate,
      officialStartDate: employee.officialStartDate,
      createdAt: employee.createdAt,
      createdBy: employee.createdBy,
      updatedAt: employee.updatedAt,
      updatedBy: employee.updatedBy,
    };
  }

  static mapBranches(
    this: void,
    employee: EmployeeWithBranches,
  ): EmployeeResponseDto {
    return {
      branches: employee.branches.map((branch) => BranchMapper.mapLite(branch)),
    };
  }

  static mapUser(this: void, employee: Employee): Partial<EmployeeResponseDto> {
    return {
      user: UserMapper.mapLite(employee.user!),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    employee: Partial<EmployeeResponseDto & EmployeeWithBranches>,
  ): Partial<EmployeeResponseDto> {
    return {
      ...EmployeeMapper.mapBase(employee as Employee),
      ...EmployeeMapper.mapBranches(employee),
    } as Partial<EmployeeResponseDto>;
  }

  // 🔁 Mapper list
  static toDtos(employees: EmployeeWithBranches[]): EmployeeResponseDto[] {
    return employees.map(EmployeeMapper.toDto);
  }
}
