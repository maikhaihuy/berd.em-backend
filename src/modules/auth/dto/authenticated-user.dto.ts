import { ApiProperty } from '@nestjs/swagger';

// this response dto is used for jwt strategy
export class AuthenticatedUserDto {
  @ApiProperty()
  userId!: number;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  employeeId?: number;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  branches!: number[]; // Danh sách ID chi nhánh được phép quản lý/làm việc

  constructor(partial: Partial<AuthenticatedUserDto>) {
    Object.assign(this, partial);
  }
}
