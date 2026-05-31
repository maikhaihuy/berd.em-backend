import { Prisma } from '@prisma/client';

export const availabilityWithEmployeeInclude = {
  employee: true,
  subShift: {
    include: {
      masterShift: {
        select: { id: true, title: true, branchId: true, workDate: true },
      },
    },
  },
} satisfies Prisma.AvailabilityInclude;

export type AvailabilityWithEmployee = Prisma.AvailabilityGetPayload<{
  include: typeof availabilityWithEmployeeInclude;
}>;
