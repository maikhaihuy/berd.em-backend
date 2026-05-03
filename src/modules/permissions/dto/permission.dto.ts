import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  subject?: string | null;

  @ApiProperty()
  description?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class PermissionLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  subject?: string | null;
}
