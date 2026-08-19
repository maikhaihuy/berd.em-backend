import { Prisma } from '@prisma/client';

export const taskInclude = {
  taskTemplate: true,
  masterShift: { select: { id: true, title: true, workDate: true } },
  subShift: { select: { id: true, title: true, masterShiftId: true } },
  completion: true,
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;

export const taskCompletionInclude = {
  task: true,
  completedByEmployee: true,
} satisfies Prisma.TaskCompletionInclude;

export type TaskCompletionWithRelations = Prisma.TaskCompletionGetPayload<{
  include: typeof taskCompletionInclude;
}>;
