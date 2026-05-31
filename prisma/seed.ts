import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // SETTINGS user configuration (override via env if desired)
  const SETTINGS_USERNAME = process.env.SETTINGS_USERNAME?.trim() || 'settings';
  const SETTINGS_PASSWORD =
    process.env.SETTINGS_PASSWORD?.trim() || 'ChangeMe!123';

  // 0) Create a temporary system user ID for seed operations
  // We'll use ID 1 as the SYSTEM_USER_ID, ensuring it exists before dependencies
  const SYSTEM_USER_ID = 1;

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
    // Shift and task domain
    ...[
      'master-shift-templates',
      'sub-shift-templates',
      'task-templates',
      'master-shifts',
      'sub-shifts',
      'assignments',
      'availability',
      'attendance-history',
      'leave-requests',
      'time-logs',
      'tasks',
    ].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'update', subject, description: `Update ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),
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
        rolePermissions: {
          create: role.permissionIds.map((permissionId) => ({
            permission: {
              connect: {
                id: permissionId,
              },
            },
          })),
        },
      },
      update: {
        description: role.description,
        updatedBy: SYSTEM_USER_ID,
        rolePermissions: {
          create: role.permissionIds.map((permissionId) => ({
            permission: {
              connect: {
                id: permissionId,
              },
            },
          })),
        },
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  // 4) Create or update SETTINGS user (after roles exist for proper FK dependency)
  // Idempotent: upsert ensures it's safe to run multiple times
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });

  if (!adminRole) {
    throw new Error('Admin role must exist before creating SETTINGS user');
  }

  const hashed = await bcrypt.hash(SETTINGS_PASSWORD, 12);

  const settingsUser = await prisma.user.upsert({
    where: { phoneNumber: SETTINGS_USERNAME },
    update: {
      password: hashed,
      status: 'ACTIVE',
      role: {
        connect: { id: adminRole.id },
      },
    },
    create: {
      id: SYSTEM_USER_ID,
      phoneNumber: SETTINGS_USERNAME,
      zaloId: `zalo_${SETTINGS_USERNAME}`,
      fullName: 'Settings User',
      password: hashed,
      status: 'ACTIVE',
      roleId: adminRole.id,
    },
    include: {
      role: true,
    },
  });

  console.log(
    'Seed completed: permissions, roles, and SETTINGS user upserted.',
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
