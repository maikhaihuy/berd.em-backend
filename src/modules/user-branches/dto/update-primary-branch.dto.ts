import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePrimaryBranchDto {
  @ApiProperty({ description: 'Branch ID to set as primary', example: 1 })
  @IsInt()
  branchId!: number;
}
