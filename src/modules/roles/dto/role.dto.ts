import { ApiProperty } from '@nestjs/swagger';

export class RoleDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description?: string | null;

  @ApiProperty({
    description:
      'True for the seeded base roles (Admin, Manager, Employee); such a ' +
      'role cannot be deleted through the API.',
  })
  isSystemRole!: boolean;

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
