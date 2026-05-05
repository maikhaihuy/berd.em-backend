import { Prisma } from '@prisma/client';

// Base include (reuse được)
export const employeeWithBranchesInclude = {
  branches: true,
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithBranches = Prisma.EmployeeGetPayload<{
  include: typeof employeeWithBranchesInclude;
}>;

export const employeeWithAvailabilitiesInclude = {
  availabilities: true,
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithAvailabilities = Prisma.EmployeeGetPayload<{
  include: typeof employeeWithAvailabilitiesInclude;
}>;
