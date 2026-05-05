import { ApiProperty } from '@nestjs/swagger';
import { EmployeeDto } from './employee.dto';
import { UserLiteDto } from '@modules/users/dto/user.dto';

export class EmployeeResponseDto extends EmployeeDto {
  @ApiProperty({ type: [Object] }) // You might want to create a separate PermissionResponseDto
  user?: UserLiteDto;
}
