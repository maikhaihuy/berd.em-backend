import { Prisma } from '@prisma/client';

export const payrollEntryInclude = {
  timeLog: true,
  employee: { select: { id: true, fullName: true } },
  payPeriod: {
    select: { id: true, status: true, startDate: true, endDate: true },
  },
} satisfies Prisma.PayrollEntryInclude;

export type PayrollEntryWithRelations = Prisma.PayrollEntryGetPayload<{
  include: typeof payrollEntryInclude;
}>;
