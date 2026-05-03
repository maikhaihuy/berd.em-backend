import { ApiProperty } from '@nestjs/swagger';

export class UserBranchResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: number;

  @ApiProperty({ description: 'Branch ID' })
  branchId: number;

  @ApiProperty({ description: 'Is this the primary branch for the user' })
  isPrimary: boolean;

  @ApiProperty({ description: 'Branch name', required: false })
  branchName?: string;

  @ApiProperty({ description: 'Branch abbreviation', required: false })
  branchAbbreviation?: string;
}
