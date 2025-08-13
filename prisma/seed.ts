// import { prisma } from '@/lib/prisma';

// const initialBranches = [
//   {
//     name: 'Soli 62 Tân Tạo',
//     abbreviation: 'TT',
//     address: '14 đường số 2, phường Tân Tạo, quận Bình Tân, Tp. Hồ Chí Minh',
//     email: 'soli.tantao@gmail.com',
//     phone: '0333 717 560',
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
//   {
//     name: 'Soli 14 Nguyễn Văn Luông',
//     abbreviation: 'NVL',
//     address: '109/24 Nguyễn Văn Luông, phường 10, quận 6, Tp. Hồ Chí Minh',
//     email: 'soli.nvl@gmail.com',
//     phone: '0333 250 017',
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
// ];

// const initialEmployees = [
//   {
//     name: 'Tracy Bell',
//     phone: '0901 234 567',
//     avatar: null,
//     email: 'nguyenvana@example.com',
//     address: '14 đường số 2, phường Tân Tạo, quận Bình Tân, Tp. Hồ Chí Minh',
//     isActive: true,
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
//   {
//     name: 'Mike Godfrey',
//     phone: '0902 345 678',
//     avatar: null,
//     email: 'tranthib@example.com',
//     address: '109/24 Nguyễn Văn Luông, phường 10, quận 6, Tp. Hồ Chí Minh',
//     isActive: true,
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
// ];

// async function main() {
//   const branches = [];
//   for (const branch of initialBranches) {
//     branches.push(await prisma.branch.create({ data: branch }));
//   }
//   for (const employee of initialEmployees) {
//     await prisma.employee.create({
//       data: {
//         ...employee,
//         // Remove the id property if your Employee model uses autoincrement
//         // id: employee.id, // Remove/comment this line if autoincrement
//         branches: {
//           connect: branches.map((branch) => ({ id: branch.id })),
//         },
//       },
//     });
//   }
// }

// main()
//   .then(() => console.log('Seeding done.'))
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   });
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
      createdBy: 1,
      updatedBy: 1,
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
        description: role.description,
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
        updatedBy: SYSTEM_USER_ID,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
