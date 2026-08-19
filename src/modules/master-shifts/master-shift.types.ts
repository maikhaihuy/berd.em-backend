import { Prisma } from '@prisma/client';

export const masterShiftInclude = {
  branch: { select: { id: true, name: true, abbreviation: true } },
  masterShiftTemplate: { select: { id: true, name: true } },
  subShifts: true,
  tasks: { include: { completion: true } },
} satisfies Prisma.MasterShiftInclude;

export type MasterShiftWithRelations = Prisma.MasterShiftGetPayload<{
  include: typeof masterShiftInclude;
}>;
