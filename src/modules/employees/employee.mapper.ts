import { Employee } from '@prisma/client';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { EmployeeWithBranches, EmployeeWithUser } from './employee.types';
import { UserMapper } from '@modules/users/user.mapper';
import { BranchMapper } from '@modules/branches/branch.mapper';
import { EmployeeDto, EmployeeLiteDto } from './dto/employee.dto';

export class EmployeeMapper {
  // 🧱 Base mapper
  // Annotate this: void cho static method
  static mapBase(this: void, employee: Employee): EmployeeDto {
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
  static mapLite(this: void, employee: Employee): EmployeeLiteDto {
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
    this: void,
    employee: Partial<Employee & EmployeeWithBranches>,
  ): Partial<EmployeeResponseDto> {
    return {
      branches: employee.employeeBranches.map((ep) =>
        BranchMapper.mapLite(ep.branch),
      ),
    };
  }

  static mapUser(
    this: void,
    employee: EmployeeWithUser,
  ): Partial<EmployeeResponseDto> {
    return {
      user: UserMapper.mapLite(employee.user!),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    employee: Partial<EmployeeResponseDto & EmployeeWithBranches>,
  ): EmployeeResponseDto {
    return {
      ...EmployeeMapper.mapBase(employee as Employee),
      ...EmployeeMapper.mapBranches(employee as EmployeeWithBranches),
    } as EmployeeResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(employees: EmployeeWithBranches[]): EmployeeResponseDto[] {
    return employees.map(EmployeeMapper.toDto);
  }
}
