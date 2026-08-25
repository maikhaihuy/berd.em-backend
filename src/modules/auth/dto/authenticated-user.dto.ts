import { ApiProperty } from '@nestjs/swagger';

// this response dto is used for jwt strategy
export class AuthenticatedUserDto {
  @ApiProperty()
  userId!: number;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  employeeId?: number;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  branches!: number[]; // Danh sách ID chi nhánh mà nhân viên làm việc

  @ApiProperty()
  managedBranches!: number[]; // Danh sách ID chi nhánh được phép quản lý (ManagerBranch)

  @ApiProperty()
  permissions!: {
    action: string;
    subject: string;
    condition?: Record<string, unknown> | null;
  }[]; // (action, subject) pairs from the user's role, plus an optional row-scoping condition

  constructor(partial: Partial<AuthenticatedUserDto>) {
    Object.assign(this, partial);
  }
}
