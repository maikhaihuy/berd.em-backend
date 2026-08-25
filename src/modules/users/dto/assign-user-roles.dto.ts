import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignUserRolesDto {
  @ApiProperty({
    description:
      'Role IDs to add to the user (in addition to any they already hold)',
    example: [2],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  roleIds!: number[];
}
