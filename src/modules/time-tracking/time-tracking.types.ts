import { Prisma } from '@prisma/client';

// TimeLog responses do not currently embed any relations; the include is kept
// empty so the query shape lives in one place, consistent with the other
// operational modules. Add relation keys here (and to the mapper) if a future
// change needs to embed assignment/employee data.
export const timeLogInclude = {} satisfies Prisma.TimeLogInclude;

export type TimeLogWithRelations = Prisma.TimeLogGetPayload<{
  include: typeof timeLogInclude;
}>;
