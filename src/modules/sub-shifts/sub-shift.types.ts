import { Prisma } from '@prisma/client';

export const subShiftInclude = {
  masterShift: {
    select: {
      id: true,
      title: true,
      branchId: true,
      workDate: true,
    },
  },
  subShiftTemplate: { select: { id: true, name: true, type: true } },
  tasks: { include: { completion: true } },
} satisfies Prisma.SubShiftInclude;

export type SubShiftWithRelations = Prisma.SubShiftGetPayload<{
  include: typeof subShiftInclude;
}>;
