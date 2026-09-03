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

export class EmployeeCreatedResponseDto extends EmployeeResponseDto {
  @ApiProperty({
    description:
      'One-time password for the auto-provisioned account, returned only in this response — relay it to the employee out of band. It cannot be retrieved again; re-issue a new one via the users endpoint if lost.',
  })
  temporaryPassword: string;
}
