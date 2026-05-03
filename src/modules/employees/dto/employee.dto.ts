import { BranchDto } from '@modules/branches/dto/branch.dto';
import { ApiProperty } from '@nestjs/swagger';

export class EmployeeDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty()
  dateOfBirth?: Date;

  @ApiProperty()
  avatar?: string;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  address?: string;

  @ApiProperty()
  probationStartDate?: Date;

  @ApiProperty()
  officialStartDate?: Date;

  @ApiProperty()
  createdAt?: Date;

  @ApiProperty()
  updatedAt?: Date;

  branches?: BranchDto[];
}

export class EmployeeLiteDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  dateOfBirth?: Date;

  @ApiProperty({ required: false })
  probationStartDate?: Date;

  @ApiProperty({ required: false })
  officialStartDate?: Date;
}
