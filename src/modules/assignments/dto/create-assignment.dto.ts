import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkSlotStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsInt()
  employeeId!: number;

  @ApiProperty()
  @IsInt()
  subShiftId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  availabilityId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedAt?: string;

  @ApiPropertyOptional({
    enum: WorkSlotStatus,
    default: WorkSlotStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(WorkSlotStatus)
  status?: WorkSlotStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
