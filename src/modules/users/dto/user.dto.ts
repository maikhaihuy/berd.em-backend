import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class UserDto {
  @ApiProperty({ description: 'User ID' })
  id!: number;

  @ApiProperty({ description: 'Phone number' })
  phoneNumber!: string;

  @ApiProperty({ description: 'Full name' })
  fullName!: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string | null;

  @ApiProperty({ description: 'User status', enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class UserLiteDto {
  @ApiProperty({ description: 'User ID' })
  id!: number;

  @ApiProperty({ description: 'Full name' })
  fullName!: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string | null;
}
