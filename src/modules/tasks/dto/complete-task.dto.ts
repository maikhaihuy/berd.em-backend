import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CompleteTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  completedByEmployeeId?: number;

  @ApiPropertyOptional({ description: 'Evidence JSON such as photo URLs' })
  @IsOptional()
  evidence?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
