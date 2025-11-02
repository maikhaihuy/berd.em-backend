import {
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { RosterStatus } from '@prisma/client';

export class CreateRosterDto {
  @IsInt()
  scheduleId: number;

  @IsInt()
  employeeId: number;

  @IsDateString()
  assignedAt?: Date;

  @IsDateString()
  actualStartTime: Date;

  @IsDateString()
  actualEndTime: Date;

  @IsEnum(RosterStatus)
  status: RosterStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
