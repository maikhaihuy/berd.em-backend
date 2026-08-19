import { Prisma } from '@prisma/client';

export const subShiftTemplateInclude = {
  branch: { select: { id: true, name: true, abbreviation: true } },
  masterShiftTemplate: { select: { id: true, name: true } },
  taskTemplates: true,
} satisfies Prisma.SubShiftTemplateInclude;

export type SubShiftTemplateWithRelations =
  Prisma.SubShiftTemplateGetPayload<{
    include: typeof subShiftTemplateInclude;
  }>;
