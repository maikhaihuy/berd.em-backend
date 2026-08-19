import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // SETTINGS user configuration (override via env if desired)
  const SETTINGS_USERNAME = process.env.SETTINGS_USERNAME?.trim() || 'settings';
  const SETTINGS_PASSWORD =
    process.env.SETTINGS_PASSWORD?.trim() || 'ChangeMe!123';
  const DEV_EMPLOYEE_PHONE =
    process.env.DEV_EMPLOYEE_PHONE?.trim() || '0900000001';
  const DEV_EMPLOYEE_EMAIL =
    process.env.DEV_EMPLOYEE_EMAIL?.trim() || 'dev.employee@staffhub.local';
  const DEV_EMPLOYEE_NAME =
    process.env.DEV_EMPLOYEE_NAME?.trim() || 'Nhân viên Dev';
  const DEV_EMPLOYEE_PASSWORD =
    process.env.DEV_EMPLOYEE_PASSWORD?.trim() || 'DevLogin!123';
  const DEV_BRANCH_NAME =
    process.env.DEV_BRANCH_NAME?.trim() || 'Chi nhánh Dev';
  const DEV_BRANCH_ABBREVIATION =
    process.env.DEV_BRANCH_ABBREVIATION?.trim() || 'DEV';

  // 0) Create a temporary system user ID for seed operations
  // We'll use ID 1 as the SYSTEM_USER_ID, ensuring it exists before dependencies
  const SYSTEM_USER_ID = 1;
  const DEV_USER_ID = 2; // ID for the dev employee user

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
    // Role-permission links
    ...['role-permissions'].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'update', subject, description: `Update ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),

    // Core entities
    ...['branches', 'employees', 'employee-hourly-rates'].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'update', subject, description: `Update ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),

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
          deleteMany: {},
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
      fullName: 'Settings User',
      password: hashed,
      status: 'ACTIVE',
      roleId: adminRole.id,
    },
    include: {
      role: true,
    },
  });

  const employeeRole = await prisma.role.findUnique({
    where: { name: 'Employee' },
  });

  if (!employeeRole) {
    throw new Error('Employee role must exist before creating dev employee');
  }

  const devPasswordHash = await bcrypt.hash(DEV_EMPLOYEE_PASSWORD, 12);

  const devUser = await prisma.user.upsert({
    where: { phoneNumber: DEV_EMPLOYEE_PHONE },
    update: {
      fullName: DEV_EMPLOYEE_NAME,
      password: devPasswordHash,
      status: 'ACTIVE',
      role: {
        connect: { id: employeeRole.id },
      },
    },
    create: {
      id: DEV_USER_ID,
      phoneNumber: DEV_EMPLOYEE_PHONE,
      fullName: DEV_EMPLOYEE_NAME,
      password: devPasswordHash,
      status: 'ACTIVE',
      roleId: employeeRole.id,
    },
  });

  const existingDevBranch = await prisma.branch.findFirst({
    where: { abbreviation: DEV_BRANCH_ABBREVIATION },
  });

  const devBranch = existingDevBranch
    ? await prisma.branch.update({
        where: { id: existingDevBranch.id },
        data: {
          name: DEV_BRANCH_NAME,
          abbreviation: DEV_BRANCH_ABBREVIATION,
          address: 'Địa chỉ dev',
          phone: DEV_EMPLOYEE_PHONE,
          email: DEV_EMPLOYEE_EMAIL,
          updatedBy: SYSTEM_USER_ID,
        },
      })
    : await prisma.branch.create({
        data: {
          name: DEV_BRANCH_NAME,
          abbreviation: DEV_BRANCH_ABBREVIATION,
          address: 'Địa chỉ dev',
          phone: DEV_EMPLOYEE_PHONE,
          email: DEV_EMPLOYEE_EMAIL,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        },
      });

  const devEmployee = await prisma.employee.upsert({
    where: { phoneNumber: DEV_EMPLOYEE_PHONE },
    update: {
      fullName: DEV_EMPLOYEE_NAME,
      email: DEV_EMPLOYEE_EMAIL,
      avatar: null,
      user: {
        connect: { id: devUser.id },
      },
      updatedBy: SYSTEM_USER_ID,
    },
    create: {
      fullName: DEV_EMPLOYEE_NAME,
      phoneNumber: DEV_EMPLOYEE_PHONE,
      email: DEV_EMPLOYEE_EMAIL,
      user: {
        connect: { id: devUser.id },
      },
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    },
  });

  await prisma.employeeBranch.upsert({
    where: {
      employeeId_branchId: {
        employeeId: devEmployee.id,
        branchId: devBranch.id,
      },
    },
    update: {
      isPrimary: true,
    },
    create: {
      employeeId: devEmployee.id,
      branchId: devBranch.id,
      isPrimary: true,
    },
  });

  console.log(
    'Seed completed: permissions, roles, SETTINGS user, and dev employee upserted.',
  );
  console.log(
    `Dev login employee: employeeId=${devEmployee.id}, phone=${DEV_EMPLOYEE_PHONE}, email=${DEV_EMPLOYEE_EMAIL}`,
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
