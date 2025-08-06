import { EmployeeDto } from '@modules/employees/dto/employee-dto';

export class UserDto {
  id: number;
  username: string;
  employeeId: number;
  email?: string;
  employee?: EmployeeDto;
}
