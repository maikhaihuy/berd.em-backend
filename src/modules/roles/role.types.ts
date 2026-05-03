import { Prisma } from '@prisma/client';

export const roleWithPermissionsInclude = {
  rolePermissions: {
    include: {
      permission: true,
    },
  },
} satisfies Prisma.RoleInclude;

export type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleWithPermissionsInclude;
}>;
