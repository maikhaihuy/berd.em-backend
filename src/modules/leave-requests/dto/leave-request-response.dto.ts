import { ApiProperty } from '@nestjs/swagger';
import { LeaveRequestDto } from './leave-request.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';
import { WorkSlotLiteDto } from '@modules/work-slots/dto/work-slot.dto';

export class LeaveRequestResponseDto extends LeaveRequestDto {
  @ApiProperty({
    description: 'Work slot details',
    type: () => WorkSlotLiteDto,
    required: false,
  })
  workSlot?: WorkSlotLiteDto;

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
