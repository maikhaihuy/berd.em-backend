import { Prisma } from '@prisma/client';

// Shared include used by both `assignPermissions` and `getRolePermissions`
// (previously duplicated inline in each Prisma call).
export const rolePermissionInclude = {
  role: { select: { name: true } },
  permission: { select: { action: true, subject: true } },
} satisfies Prisma.RolePermissionInclude;

export type RolePermissionWithRelations = Prisma.RolePermissionGetPayload<{
  include: typeof rolePermissionInclude;
}>;
