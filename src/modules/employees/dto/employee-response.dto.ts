import { ApiProperty } from '@nestjs/swagger';
import { EmployeeDto } from './employee.dto';
import { UserLiteDto } from '@modules/users/dto/user.dto';
import { BranchLiteDto } from '@modules/branches/dto/branch.dto';

export class EmployeeResponseDto extends EmployeeDto {
  @ApiProperty({ type: UserLiteDto, nullable: true, required: false })
  user?: UserLiteDto | null;

  @ApiProperty({ type: [BranchLiteDto], required: false })
  branches?: BranchLiteDto[] | undefined;
}
