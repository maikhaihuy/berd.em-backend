import { Prisma } from '@prisma/client';

// Base include (reuse được)
export const userWithRoleInclude = {
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export const userWithEmployeeInclude = {
  employee: true,
} satisfies Prisma.UserInclude;

// Type infer từ Prisma
export type UserWithRole = Prisma.UserGetPayload<{
  include: typeof userWithRoleInclude;
}>;

export type UserWithEmployee = Prisma.UserGetPayload<{
  include: typeof userWithEmployeeInclude;
}>;

// Advanced: RBAC sâu hơn

export const userWithRolePermissionsInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
  managerBranches: true,
  employee: {
    include: {
      employeeBranches: true,
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithRolePermissions = Prisma.UserGetPayload<{
  include: typeof userWithRolePermissionsInclude;
}>;
