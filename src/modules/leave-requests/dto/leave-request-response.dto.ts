import { ApiProperty } from '@nestjs/swagger';
import { LeaveRequestDto } from './leave-request.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';

export class LeaveRequestResponseDto extends LeaveRequestDto {
  @ApiProperty({
    description: 'Assignment details',
    required: false,
  })
  assignment?: unknown;

  @ApiProperty({
    description: 'Absence employee details',
    type: () => EmployeeLiteDto,
    required: false,
  })
  absenceEmployee?: EmployeeLiteDto;

  @ApiProperty({
    description: 'Replacement employee details',
    type: () => EmployeeLiteDto,
    required: false,
  })
  replacementEmployee?: EmployeeLiteDto;
}
