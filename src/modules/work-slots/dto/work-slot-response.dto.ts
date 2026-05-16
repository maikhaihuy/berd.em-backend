import { ApiProperty } from '@nestjs/swagger';
import { WorkSlotDto } from './work-slot.dto';

export class WorkSlotResponseDto extends WorkSlotDto {
  @ApiProperty({ description: 'Branch name', required: false })
  branchName?: string;

  @ApiProperty({ description: 'Branch abbreviation', required: false })
  branchAbbreviation?: string;

  @ApiProperty({ description: 'Employee full name', required: false })
  employeeFullName?: string;

  @ApiProperty({ description: 'Employee phone number', required: false })
  employeePhoneNumber?: string;
}
