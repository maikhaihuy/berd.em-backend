import { Prisma } from '@prisma/client';

// PayPeriod CRUD responses do not embed relations; the include is kept in one
// place for consistency with the other modules. Add relation keys here (and to
// the mapper) if a future change needs to embed payroll entries.
export const payPeriodInclude = {} satisfies Prisma.PayPeriodInclude;

export type PayPeriodWithRelations = Prisma.PayPeriodGetPayload<{
  include: typeof payPeriodInclude;
}>;
