import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '@prisma/client';

export class EmployeeResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ required: false })
  avatar?: string | null;

  @ApiProperty({ required: false })
  email?: string | null;

  @ApiProperty({ required: false })
  address?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Employee>) {
    Object.assign(this, partial);
  }
}
