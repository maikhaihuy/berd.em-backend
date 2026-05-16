import { Prisma } from '@prisma/client';

export const permissionWithRolesInclude = {
  rolePermissions: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.PermissionInclude;

export type PermissionWithRoles = Prisma.PermissionGetPayload<{
  include: typeof permissionWithRolesInclude;
}>;
