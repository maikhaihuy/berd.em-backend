import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsInt } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({
    type: [Number],
    description: 'An array of role IDs to assign to the user.',
  })
  @IsInt({ each: true })
  @ArrayNotEmpty()
  roleIds: number[];
}
