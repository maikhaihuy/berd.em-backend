import { ApiProperty } from '@nestjs/swagger';
import { RoleLiteDto } from '@modules/roles/dto/role.dto';
import { UserDto } from './user.dto';

export class UserResponseDto extends UserDto {
  @ApiProperty({ description: 'Roles held by this user', type: [RoleLiteDto] })
  roles!: RoleLiteDto[];

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
