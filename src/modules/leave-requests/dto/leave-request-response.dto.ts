import { ApiProperty } from '@nestjs/swagger';
import { LeaveRequestDto } from './leave-request.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';

export class LeaveRequestResponseDto extends LeaveRequestDto {
  @ApiProperty({ description: 'Work slot details' })
  workSlot!: WorkSlotLiteDto;

  @ApiProperty({ description: 'Absence employee ID', example: 1 })
  absenceEmployee!: EmployeeLiteDto;

  @ApiProperty({ description: 'Replacement employee ID', example: 2 })
  replacementEmployee!: EmployeeLiteDto;

  @ApiProperty({ description: 'Approved by user ID', required: false })
  approver?: EmployeeLiteDto | null;
}
