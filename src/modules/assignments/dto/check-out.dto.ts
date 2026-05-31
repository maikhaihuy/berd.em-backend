import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignmentCheckOutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualEndTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
