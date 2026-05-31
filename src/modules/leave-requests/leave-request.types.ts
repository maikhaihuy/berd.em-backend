import { Prisma } from '@prisma/client';

export const leaveRequestWithRelationsInclude = {
  assignment: {
    include: {
      employee: {
        select: { id: true, fullName: true, phoneNumber: true },
      },
      subShift: {
        include: {
          masterShift: {
            select: { id: true, title: true, branchId: true, workDate: true },
          },
        },
      },
    },
  },
  absenceEmployee: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
    },
  },
  replacementEmployee: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
    },
  },
} satisfies Prisma.LeaveRequestInclude;

export type LeaveRequestWithRelations = Prisma.LeaveRequestGetPayload<{
  include: typeof leaveRequestWithRelationsInclude;
}>;
