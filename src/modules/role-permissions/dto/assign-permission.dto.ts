import {
  IsInt,
  IsArray,
  ArrayNotEmpty,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PermissionGrantDto {
  @ApiProperty({ description: 'Permission ID', example: 1 })
  @IsInt()
  permissionId!: number;

  @ApiProperty({
    description:
      'Optional row-scoping condition for this grant (a partial Prisma ' +
      '`where` object, `$self`-token-bearing, e.g. { "employeeId": "$self" }). ' +
      'Omit for an unconditioned (unscoped) grant.',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}

export class AssignPermissionsDto {
  @ApiProperty({ description: 'Role ID', example: 1 })
  @IsInt()
  roleId!: number;

  @ApiProperty({
    description:
      'Grants to create or update on this role. Additive: only the ' +
      "(roleId, permissionId) pairs listed here are affected — the role's " +
      'other existing grants are left untouched.',
    type: [PermissionGrantDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermissionGrantDto)
  grants!: PermissionGrantDto[];
}
