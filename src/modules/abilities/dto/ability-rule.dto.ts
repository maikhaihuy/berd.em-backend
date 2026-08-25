import { ApiProperty } from '@nestjs/swagger';

export class AbilityRuleDto {
  @ApiProperty({ description: 'The permitted action, e.g. "read"' })
  action!: string;

  @ApiProperty({
    description: 'The subject the action applies to, e.g. "time-logs"',
  })
  subject!: string;

  @ApiProperty({
    description: 'Whether this rule forbids (true) rather than permits',
  })
  inverted!: boolean;

  @ApiProperty({
    description:
      'Resolved row-scoping condition (post `$self` resolution against the target identity), or absent for an unconditioned grant',
    required: false,
  })
  conditions?: Record<string, unknown>;
}
