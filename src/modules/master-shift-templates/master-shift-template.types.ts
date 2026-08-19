import { Prisma } from '@prisma/client';

export const masterShiftTemplateInclude = {
  branch: { select: { id: true, name: true, abbreviation: true } },
  subShiftTemplates: true,
  taskTemplates: true,
} satisfies Prisma.MasterShiftTemplateInclude;

export type MasterShiftTemplateWithRelations =
  Prisma.MasterShiftTemplateGetPayload<{
    include: typeof masterShiftTemplateInclude;
  }>;
