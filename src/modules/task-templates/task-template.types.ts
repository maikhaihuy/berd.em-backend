import { Prisma } from '@prisma/client';

export const taskTemplateInclude = {
  branch: { select: { id: true, name: true, abbreviation: true } },
  masterShiftTemplate: { select: { id: true, name: true } },
  subShiftTemplate: { select: { id: true, name: true, type: true } },
} satisfies Prisma.TaskTemplateInclude;

export type TaskTemplateWithRelations = Prisma.TaskTemplateGetPayload<{
  include: typeof taskTemplateInclude;
}>;
