import { ApiProperty } from '@nestjs/swagger';

export class RoleDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

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

export class RoleLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}
