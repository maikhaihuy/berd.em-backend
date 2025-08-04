import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';

export class UpdateUserRolesDto {
  @ApiProperty({
    example: [1, 2],
    description: 'Array of role IDs to assign to the user',
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(0)
  roleIds: number[];
}
