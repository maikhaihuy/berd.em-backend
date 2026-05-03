import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { TimeLogStatus } from '@prisma/client';

export class UpdateTimeLogDto {
  @ApiProperty({
    description: 'Actual start time',
    required: false,
    example: '2026-05-01T08:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  actualStartTime?: string;

  @ApiProperty({
    description: 'Actual end time',
    required: false,
    example: '2026-05-01T17:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @ApiProperty({
    description: 'Requested start time',
    required: false,
    example: '2026-05-01T08:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  requestStartTime?: string;

  @ApiProperty({
    description: 'Requested end time',
    required: false,
    example: '2026-05-01T17:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  requestEndTime?: string;

  @ApiProperty({
    description: 'Overtime minutes',
    required: false,
    example: 30,
  })
  @IsOptional()
  @IsInt()
  overtimeMinutes?: number;

  @ApiProperty({
    description: 'Pay multiplier',
    required: false,
    example: 1.5,
  })
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiProperty({
    description: 'Request date',
    required: false,
    example: '2026-05-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @ApiProperty({
    description: 'Reason for adjustment request',
    required: false,
    example: 'Forgot to clock in',
  })
  @IsOptional()
  @IsString()
  requestReason?: string;

  @ApiProperty({
    description: 'Time log status',
    enum: TimeLogStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimeLogStatus)
  status?: TimeLogStatus;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Worked extra hours on project',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
