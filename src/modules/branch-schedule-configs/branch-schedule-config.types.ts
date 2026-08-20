import { Prisma } from '@prisma/client';

export const branchScheduleConfigInclude =
  {} satisfies Prisma.BranchScheduleConfigInclude;

export type BranchScheduleConfigWithRelations =
  Prisma.BranchScheduleConfigGetPayload<{
    include: typeof branchScheduleConfigInclude;
  }>;
