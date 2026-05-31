import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AttendanceAction } from '@prisma/client';
import { Type } from 'class-transformer';

export class AttendanceHistoryFilterDto {
  @ApiProperty({
    description: 'Filter by assignment ID',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assignmentId?: number;

  @ApiProperty({
    description: 'Filter by employee ID',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  employeeId?: number;

  @ApiProperty({
    description: 'Filter by action',
    enum: AttendanceAction,
    required: false,
  })
  @IsOptional()
  @IsEnum(AttendanceAction)
  action?: AttendanceAction;

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
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
