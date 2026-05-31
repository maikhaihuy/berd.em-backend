import { Prisma } from '@prisma/client';

export const branchWithEmployeesInclude = {
  employeeBranches: {
    include: {
      employee: true,
    },
  },
} satisfies Prisma.BranchInclude;

export type BranchWithEmployees = Prisma.BranchGetPayload<{
  include: typeof branchWithEmployeesInclude;
}>;

export const branchWithScheduleDomainInclude = {
  masterShiftTemplates: true,
  subShiftTemplates: true,
  taskTemplates: true,
  masterShifts: true,
} satisfies Prisma.BranchInclude;

export type BranchWithScheduleDomain = Prisma.BranchGetPayload<{
  include: typeof branchWithScheduleDomainInclude;
}>;
