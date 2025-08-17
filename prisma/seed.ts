import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // SETTINGS user configuration (override via env if desired)
  const SETTINGS_USERNAME = process.env.SETTINGS_USERNAME?.trim() || 'settings';
  const SETTINGS_PASSWORD =
    process.env.SETTINGS_PASSWORD?.trim() || 'ChangeMe!123';
  // 0) Ensure SETTINGS user exists first (idempotent)
  // We intentionally set id: 1 so createdBy/updatedBy=1 in services remain valid.
  // Self-reference on createdBy/updatedBy is acceptable because the row exists at insert time.
  const hashed = await bcrypt.hash(SETTINGS_PASSWORD, 10);

  const settingsUser = await prisma.user.upsert({
    where: { username: SETTINGS_USERNAME },
    update: {},
    create: {
      id: 1,
      username: SETTINGS_USERNAME,
      password: hashed,
      status: 'ACTIVE',
    },
  });

  const SYSTEM_USER_ID = settingsUser.id;

  // 1) Seed permissions (createMany + skipDuplicates for idempotency)
  const permissionsSeed = [
    // Users
    { action: 'create', subject: 'users', description: 'Create users' },
    { action: 'read', subject: 'users', description: 'Read users' },
    { action: 'update', subject: 'users', description: 'Update users' },
    { action: 'delete', subject: 'users', description: 'Delete users' },

    // Roles
    { action: 'create', subject: 'roles', description: 'Create roles' },
    { action: 'read', subject: 'roles', description: 'Read roles' },
    { action: 'update', subject: 'roles', description: 'Update roles' },
    { action: 'delete', subject: 'roles', description: 'Delete roles' },

    // Permissions
    {
      action: 'create',
      subject: 'permissions',
      description: 'Create permissions',
    },
    { action: 'read', subject: 'permissions', description: 'Read permissions' },
    {
      action: 'update',
      subject: 'permissions',
      description: 'Update permissions',
    },
    {
      action: 'delete',
      subject: 'permissions',
      description: 'Delete permissions',
    },
  ].map((p) => ({
    ...p,
    createdBy: SYSTEM_USER_ID,
    updatedBy: SYSTEM_USER_ID,
  }));

  await prisma.permission.createMany({
    data: permissionsSeed,
    skipDuplicates: true, // relies on @@unique([action, subject])
  });

  const allPermissions = await prisma.permission.findMany();

  const idsFor = (filters: { action?: string[]; subject?: string[] }) => {
    const { action, subject } = filters;
    return allPermissions
      .filter((p) => (action ? action.includes(p.action) : true))
      .filter((p) => (subject ? subject.includes(p.subject) : true))
      .map((p) => p.id);
  };

  // 2) Compute role permission sets
  const adminPermissionIds = allPermissions.map((p) => p.id);
  const managerPermissionIds = idsFor({ action: ['read', 'update'] });
  const employeePermissionIds = idsFor({ action: ['read'] });

  // 3) Upsert roles and assign permissions
  const rolesSeed: Array<{
    name: string;
    description?: string;
    permissionIds: number[];
  }> = [
    {
      name: 'Admin',
      description: 'System administrator with full access',
      permissionIds: adminPermissionIds,
    },
    {
      name: 'Manager',
      description: 'Manager with read/update access',
      permissionIds: managerPermissionIds,
    },
    {
      name: 'Employee',
      description: 'Standard user with read-only access',
      permissionIds: employeePermissionIds,
    },
  ];

  for (const role of rolesSeed) {
    await prisma.role.upsert({
      where: { name: role.name }, // assumes unique on name
      create: {
        name: role.name,
        description: role.description || '',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
        permissions: {
          connect: role.permissionIds.map((id) => ({ id })),
        },
      },
      update: {
        description: role.description,
        updatedBy: SYSTEM_USER_ID,
        permissions: {
          set: role.permissionIds.map((id) => ({ id })), // idempotent
        },
      },
      include: { permissions: true },
    });
  }

  // 4) Ensure the SETTINGS user has Admin role
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  if (adminRole) {
    await prisma.user.update({
      where: { id: SYSTEM_USER_ID },
      data: {
        roles: {
          set: [{ id: adminRole.id }],
        },
      },
    });
  }

  console.log(
    'Seed completed: SETTINGS user/employee, permissions, and roles upserted.',
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    await prisma.$disconnect();
  });
