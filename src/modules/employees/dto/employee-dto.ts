import { BranchDto } from '@modules/branches/dto/branch-dto';
import { ApiProperty } from '@nestjs/swagger';

export class EmployeeDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  phone: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  isActive?: boolean;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;

  branches?: BranchDto[];
}
