import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  employeeId: number;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  roles?: string[];
}
