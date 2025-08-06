import { BranchDto } from '@modules/branches/dto/branch-dto';

export class EmployeeDto {
  id: number;
  name: string;
  phone: string;
  avatar: string;
  email?: string;
  address?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  branches?: BranchDto[];
}
