import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditLogFilterDto {
  @ApiProperty({
    description: 'Filter by subject (e.g. "leave-requests")',
    required: false,
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    description: 'Filter by the actor (User) who performed the mutation',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  actorId?: number;

  @ApiProperty({
    description: 'Filter by the id of the affected entity',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entityId?: number;

  @ApiProperty({
    description: 'Filter from date (ISO 8601)',
    required: false,
    example: '2026-05-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'Filter to date (ISO 8601)',
    required: false,
    example: '2026-05-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({
    description: 'Page number (for pagination)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Items per page (for pagination)',
    required: false,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
