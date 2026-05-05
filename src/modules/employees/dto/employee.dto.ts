import { ApiProperty } from '@nestjs/swagger';

export class EmployeeDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty()
  dateOfBirth?: Date | null;

  @ApiProperty()
  avatar?: string | null;

  @ApiProperty()
  email?: string | null;

  @ApiProperty()
  address?: string | null;

  @ApiProperty()
  probationStartDate?: Date | null;

  @ApiProperty()
  officialStartDate?: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  createdBy!: number;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  updatedBy!: number;
}

export class EmployeeLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty({ required: false })
  email?: string | null;

  @ApiProperty({ required: false })
  avatar?: string | null;

  @ApiProperty({ required: false })
  address?: string | null;

  @ApiProperty({ required: false })
  dateOfBirth?: Date | null;

  @ApiProperty({ required: false })
  probationStartDate?: Date | null;

  @ApiProperty({ required: false })
  officialStartDate?: Date | null;
}
