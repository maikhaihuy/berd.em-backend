import { ApiProperty } from '@nestjs/swagger';
import { BranchDto } from './branch.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';

export class BranchResponseDto extends BranchDto {
  @ApiProperty({
    description: 'List of employees associated with the branch',
    required: false,
    type: 'array',
  })
  employees?: Array<EmployeeLiteDto>;
}
