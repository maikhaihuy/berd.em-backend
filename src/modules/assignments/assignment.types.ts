import { Prisma } from '@prisma/client';

export const assignmentInclude = {
  employee: { select: { id: true, fullName: true, phoneNumber: true } },
  availability: true,
  subShift: {
    include: {
      masterShift: {
        select: { id: true, branchId: true, title: true, workDate: true },
      },
    },
  },
} satisfies Prisma.AssignmentInclude;

export type AssignmentWithRelations = Prisma.AssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;
