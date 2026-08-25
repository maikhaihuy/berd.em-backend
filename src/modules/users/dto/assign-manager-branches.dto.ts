import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignManagerBranchesDto {
  @ApiProperty({
    description: 'Branch IDs to add to the branches this user manages',
    example: [3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  branchIds!: number[];
}
