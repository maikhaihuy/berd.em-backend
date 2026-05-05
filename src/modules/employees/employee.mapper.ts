import { Employee } from '@prisma/client';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import {
  EmployeeWithBranches
} from './employee.types';
import { UserMapper } from '@modules/users/user.mapper';

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

  static mapUser(this: void, employee: Employee): EmployeeResponseDto {
    return {
      user: UserMapper.mapLite(employee.user!),
    };
  }

  // 🚀 Main mapper (1 entry point)
  static toDto(
    this: void,
    employee: Partial<EmployeeWithRole & EmployeeWithBranches>,
  ): EmployeeResponseDto {
    return {
      ...EmployeeMapper.mapBase(employee as Employee),
      ...EmployeeMapper.mapRole(employee),
      ...EmployeeMapper.mapBranches(employee),
    } as EmployeeResponseDto;
  }

  // 🔁 Mapper list
  static toDtos(employees: EmployeeWithRole[]): EmployeeResponseDto[] {
    return employees.map(EmployeeMapper.toDto);
  }
}
