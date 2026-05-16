import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TimeLogStatus } from '@prisma/client';

export class VerifyTimeLogDto {
  @ApiProperty({
    description: 'Verification status',
    enum: [TimeLogStatus.VERIFIED, TimeLogStatus.REJECTED],
    example: TimeLogStatus.VERIFIED,
  })
  @IsEnum([TimeLogStatus.VERIFIED, TimeLogStatus.REJECTED])
  status: TimeLogStatus;

  @ApiProperty({
    description: 'Optional note for verification',
    required: false,
    example: 'Verified - all hours correct',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
