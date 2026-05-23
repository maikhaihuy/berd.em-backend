import { Prisma } from '@prisma/client';

export const leaveRequestWithRelationsInclude = {
  workSlot: {
    select: {
      id: true,
      branchId: true,
      employeeId: true,
      assignedAt: true,
      startTime: true,
      endTime: true,
      actualStartTime: true,
      actualEndTime: true,
      status: true,
      note: true,
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
