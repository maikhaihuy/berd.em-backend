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

export const branchWithShiftsInclude = {
  shifts: true,
} satisfies Prisma.BranchInclude;

export type BranchWithShifts = Prisma.BranchGetPayload<{
  include: typeof branchWithShiftsInclude;
}>;

export const branchWithWorkSlotsInclude = {
  workSlots: true,
} satisfies Prisma.BranchInclude;

export type BranchWithWorkSlots = Prisma.BranchGetPayload<{
  include: typeof branchWithWorkSlotsInclude;
}>;
