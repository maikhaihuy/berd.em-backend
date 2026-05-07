import { Employee } from '@prisma/client';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { EmployeeWithBranches, EmployeeWithUser } from './employee.types';
import { UserMapper } from '@modules/users/user.mapper';
import { BranchMapper } from '@modules/branches/branch.mapper';
import { EmployeeDto, EmployeeLiteDto } from './dto/employee.dto';

export class EmployeeMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(employee: Employee): EmployeeDto {
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
  static mapLite(employee: Employee): EmployeeLiteDto {
    return {
      id: employee.id,
      fullName: employee.fullName,
      phoneNumber: employee.phoneNumber,
      dateOfBirth: employee.dateOfBirth,
      avatar: employee.avatar,
      email: employee.email,
      address: employee.address,
      probationStartDate: employee.probationStartDate,
      officialStartDate: employee.officialStartDate,
    };
  }

  static mapBranches(
    employee: Employee & EmployeeWithBranches,
  ): Partial<EmployeeResponseDto> {
    return {
      branches: employee.employeeBranches.map((ep) =>
        BranchMapper.mapLite(ep.branch),
      ),
    };
  }

  static mapUser(
    employee: Employee & EmployeeWithUser,
  ): Partial<EmployeeResponseDto> {
    return {
      user: employee.user ? UserMapper.mapLite(employee.user) : null,
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDtoWithBranches(
    employee: Employee & EmployeeWithBranches,
  ): EmployeeResponseDto {
    return {
      ...EmployeeMapper.mapBase(employee),
      ...EmployeeMapper.mapBranches(employee),
    };
  }

  static toDtoWithUser(
    employee: Employee & EmployeeWithUser,
  ): EmployeeResponseDto {
    return {
      ...EmployeeMapper.mapBase(employee),
      ...EmployeeMapper.mapUser(employee),
    };
  }
  static toDto(
    employee: EmployeeWithBranches & EmployeeWithUser,
    options?: { withBranches?: boolean; withUser?: boolean },
  ): EmployeeResponseDto {
    return {
      ...EmployeeMapper.mapBase(employee),
      ...(options?.withBranches ? EmployeeMapper.mapBranches(employee) : {}),
      ...(options?.withUser ? EmployeeMapper.mapUser(employee) : {}),
    };
  }

  // 🔁 Mapper list
  static toDtos(
    employees: (EmployeeWithBranches & EmployeeWithUser)[],
    options?: { withBranches?: boolean; withUser?: boolean },
  ): EmployeeResponseDto[] {
    return employees.map((em) => EmployeeMapper.toDto(em, options));
  }
}
