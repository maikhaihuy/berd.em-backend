import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkSlotStatus } from '@prisma/client';

export class WorkSlotFilterDto {
  @ApiProperty({ description: 'Filter by branch ID', required: false })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;

  @ApiProperty({ description: 'Filter by employee ID', required: false })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  employeeId?: number;

  @ApiProperty({
    description: 'Filter by start date (inclusive)',
    example: '2026-05-01',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Filter by end date (inclusive)',
    example: '2026-05-31',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: WorkSlotStatus,
    required: false,
  })
  @IsEnum(WorkSlotStatus)
  @IsOptional()
  status?: WorkSlotStatus;

  @ApiProperty({
    description: 'Page number for pagination',
    default: 1,
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    default: 50,
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
