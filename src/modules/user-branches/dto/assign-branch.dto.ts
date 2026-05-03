import { IsInt, IsArray, ArrayNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignBranchesDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  @IsInt()
  userId: number;

  @ApiProperty({
    description: 'Array of branch IDs to assign',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  branchIds: number[];

  @ApiProperty({
    description: 'Primary branch ID (optional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  primaryBranchId?: number;
}
