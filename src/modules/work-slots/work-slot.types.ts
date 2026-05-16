import { Prisma } from '@prisma/client';

export const workSlotIncludeWithBranchAndEmployee = {
  branch: { select: { name: true, abbreviation: true } },
  employee: { select: { fullName: true, phoneNumber: true } },
} satisfies Prisma.WorkSlotInclude;

export type WorkSlotWithBranchAndEmployee = Prisma.WorkSlotGetPayload<{
  include: typeof workSlotIncludeWithBranchAndEmployee;
}>;
