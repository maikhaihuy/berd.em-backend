import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignmentCheckInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualStartTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
