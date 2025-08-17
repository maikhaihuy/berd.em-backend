import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [Number] })
  @IsInt({ each: true })
  @ArrayNotEmpty()
  permissionIds: number[];
}
