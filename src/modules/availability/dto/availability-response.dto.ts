import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityDto } from './availability.dto';
import { EmployeeLiteDto } from '@modules/employees/dto/employee.dto';

export class AvailabilityResponseDto extends AvailabilityDto {
  @ApiProperty({ required: false })
  employee?: EmployeeLiteDto | null;

  @ApiProperty({ required: false })
  subShift?: unknown;
}
