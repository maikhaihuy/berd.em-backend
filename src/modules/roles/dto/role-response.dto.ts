import { Permission } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [Object] }) // You might want to create a separate PermissionResponseDto
  permissions: Permission[];

  constructor(partial: Partial<RoleResponseDto>) {
    Object.assign(this, partial);
  }
}
