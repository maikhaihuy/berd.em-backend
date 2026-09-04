import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Deliberately not derived from `UpdateEmployeeDto` (e.g. via `Pick`/`Partial`) — kept as its own
 * hand-written class so a future admin-only field added to `UpdateEmployeeDto` (role, branch
 * assignment, hourly rate, status, ...) never leaks onto the self-service surface through a
 * shared base type. Combined with the global `ValidationPipe`'s `forbidNonWhitelisted: true`,
 * any field outside these three is a 400, not a silent drop.
 */
export class UpdateMyEmployeeProfileDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;
}
