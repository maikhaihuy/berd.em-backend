import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsDateString } from 'class-validator';

export class ConflictCheckDto {
  @ApiProperty({ description: 'Employee ID to check for conflicts' })
  @IsInt()
  @IsNotEmpty()
  employeeId!: number;

  @ApiProperty({
    description: 'Start time to check',
    example: '2026-05-01T09:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'End time to check',
    example: '2026-05-01T17:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}

export class ConflictResponseDto {
  @ApiProperty({ description: 'Whether there are conflicts' })
  hasConflict!: boolean;

  @ApiProperty({
    description: 'List of conflicting work slots',
    type: [Number],
  })
  conflictingWorkSlotIds!: number[];

  @ApiProperty({ description: 'Conflict details', required: false })
  message?: string;
}
