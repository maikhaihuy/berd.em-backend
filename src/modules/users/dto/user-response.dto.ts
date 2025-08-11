import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  hashedRefreshToken?: string | null;

  @ApiProperty()
  passwordResetToken?: string | null;

  @ApiProperty()
  passwordResetExpires?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [Object] }) // You might want to create a separate RoleResponseDto
  roles: Role[];

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
