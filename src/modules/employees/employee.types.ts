import { Prisma } from '@prisma/client';

export const employeeWithBranchesInclude = {
  employeeBranches: {
    include: {
      branch: true,
    },
  },
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithBranches = Prisma.EmployeeGetPayload<{
  include: typeof employeeWithBranchesInclude;
}>;

export const employeeWithUserInclude = {
  user: true,
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithUser = Prisma.EmployeeGetPayload<{
  include: typeof employeeWithUserInclude;
}>;
