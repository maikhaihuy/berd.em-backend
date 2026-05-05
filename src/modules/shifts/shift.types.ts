import { Prisma } from '@prisma/client';

export const shiftWithBranchInclude = {
  branch: true,
} satisfies Prisma.ShiftInclude;

export type ShiftWithBranch = Prisma.ShiftGetPayload<{
  include: typeof shiftWithBranchInclude;
}>;
