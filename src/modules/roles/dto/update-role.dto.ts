import { IsString, IsOptional, IsInt, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [Number], required: false })
  @IsInt({ each: true })
  @IsOptional()
  @ArrayNotEmpty()
  permissionIds?: number[];
}
