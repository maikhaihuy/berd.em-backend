import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class UserResponseDto extends UserDto {
  @ApiProperty({ description: 'Role ID' })
  roleId!: number;

  @ApiProperty({ description: 'Role name', required: false })
  roleName?: string;

  @ApiProperty({
    description: 'Assigned branches',
    required: false,
    type: 'array',
  })
  branches?: Array<{
    branchId: number;
    branchName: string;
    isPrimary: boolean;
  }>;
}
