import { ApiProperty } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  actorId!: number;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  entityId!: number;

  @ApiProperty({ type: Object, nullable: true })
  before!: Record<string, unknown> | null;

  @ApiProperty({ type: Object, nullable: true })
  after!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}
