import { Prisma } from '@prisma/client';

export const availabilityWithEmployeeInclude = {
  employee: true,
} satisfies Prisma.AvailabilityInclude;

export type AvailabilityWithEmployee = Prisma.AvailabilityGetPayload<{
  include: typeof availabilityWithEmployeeInclude;
}>;
