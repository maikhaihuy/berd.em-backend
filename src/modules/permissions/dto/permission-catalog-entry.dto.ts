import { ApiProperty } from '@nestjs/swagger';

export class ConditionTokenDto {
  @ApiProperty({ example: '$self' })
  token!: '$self' | '$managedBranches';

  @ApiProperty({
    description: 'The field name(s) on this subject the token resolves against',
    example: ['employeeId'],
    type: [String],
  })
  fields!: string[];
}

export class PermissionCatalogEntryDto {
  @ApiProperty({ example: 'time-logs' })
  subject!: string;

  @ApiProperty({ type: [String], example: ['create', 'read'] })
  actions!: string[];

  @ApiProperty({ type: [ConditionTokenDto] })
  conditionTokens!: ConditionTokenDto[];
}
