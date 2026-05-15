import { ApiProperty } from '@nestjs/swagger';
import { EmployeeHourlyRateDto } from './employee-hourly-rate.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';

export class EmployeeHourlyRateResponseDto extends EmployeeHourlyRateDto {
  @ApiProperty({
    description: 'Employee details associated with the hourly rate',
    required: false,
    type: EmployeeLiteDto,
  })
  employee?: EmployeeLiteDto;
}
