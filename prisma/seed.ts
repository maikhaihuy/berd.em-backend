import { Prisma, PrismaClient } from '@prisma/client';
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

    // Multi-role assignment (User <-> Role) and managed-branch assignment
    // (ManagerBranch, backing the `$managedBranches` condition token).
    // RBAC/admin-only, same posture as role-permissions.
    ...['user-roles', 'manager-branches'].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'update', subject, description: `Update ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),

    // Audit log: read-only, admin-only. Rows are written internally via
    // AuditLogService.record(), never through a create/update/delete route.
    {
      action: 'read',
      subject: 'audit-logs',
      description: 'Read audit-logs',
    },

    // Effective-abilities lookup for an arbitrary user (admin-scoped
    // GET /users/:id/abilities). Its own (action, subject) pair, not folded
    // into read:users, so it can be granted narrowly.
    {
      action: 'read',
      subject: 'user-abilities',
      description: "Read a user's effective, resolved abilities",
    },

    // Core entities
    ...[
      'branches',
      'employees',
      'employee-hourly-rates',
      'branch-schedule-configs',
    ].flatMap((subject) => [
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

    // Custom (non-CRUD) actions for privileged / self-service sub-operations.
    // These separate the sub-action from the generic `update` so a role can be
    // granted e.g. "check in" without also being able to edit/reassign every
    // assignment.
    {
      action: 'check-in',
      subject: 'assignments',
      description: 'Check in to an assignment',
    },
    {
      action: 'check-out',
      subject: 'assignments',
      description: 'Check out from an assignment',
    },
    {
      action: 'approve',
      subject: 'leave-requests',
      description: 'Approve or reject a leave request',
    },
    {
      action: 'cancel',
      subject: 'leave-requests',
      description: 'Cancel a leave request',
    },
    {
      action: 'verify',
      subject: 'time-logs',
      description: 'Verify or reject a time log',
    },
    {
      action: 'generate',
      subject: 'master-shifts',
      description: 'Generate master shifts from templates',
    },
    {
      action: 'complete',
      subject: 'tasks',
      description: 'Mark a task as complete',
    },

    // File uploads: generic, feature-agnostic — any authenticated caller may
    // create one (e.g. to attach task-completion evidence). Only `create` is
    // wired to a route today; `read`/`delete` are seeded for parity with
    // other subjects in case an admin cleanup UI is built later.
    ...['uploads'].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),

    // Payroll domain
    ...['pay-periods'].flatMap((subject) => [
      { action: 'create', subject, description: `Create ${subject}` },
      { action: 'read', subject, description: `Read ${subject}` },
      { action: 'update', subject, description: `Update ${subject}` },
      { action: 'delete', subject, description: `Delete ${subject}` },
    ]),
    {
      action: 'close',
      subject: 'pay-periods',
      description: 'Close a pay period (OPEN -> CLOSED)',
    },
    {
      action: 'finalize',
      subject: 'pay-periods',
      description: 'Finalize a pay period (CLOSED -> FINALIZED)',
    },
    // PayrollEntry has no hand-authored create: read/delete/generate, plus a
    // narrow `update` limited in code to the `bonus` field only.
    {
      action: 'read',
      subject: 'payroll-entries',
      description: 'Read payroll-entries',
    },
    {
      action: 'update',
      subject: 'payroll-entries',
      description: "Update a payroll entry's bonus",
    },
    {
      action: 'delete',
      subject: 'payroll-entries',
      description: 'Delete payroll-entries',
    },
    {
      action: 'generate',
      subject: 'payroll-entries',
      description: 'Generate payroll entries from verified time logs',
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

  // 2) Compute role permission sets from an explicit, least-privilege policy.
  //
  // The previous policy was subject-blind (Manager = read+update on EVERY
  // subject, Employee = read on EVERY subject), which (a) let a Manager edit the
  // RBAC/admin tables — e.g. PATCH /users/:id to change their own roleId and
  // self-promote to Admin — and (b) exposed the whole user/role/permission
  // catalog to every employee, while simultaneously locking employees out of
  // their own self-service writes. The map below fixes that.
  //
  // Custom sub-operations have dedicated actions (check-in, check-out, approve,
  // cancel, verify, generate, complete) that are seeded separately from CRUD, so
  // a role can be granted a self-service action (e.g. check-in) without the
  // generic `update` that would let it edit/reassign every record. The generic
  // `update` on assignments/leave-requests/time-logs is therefore still withheld
  // from Employee, pending row-level ownership scoping.
  const CRUD = ['create', 'read', 'update', 'delete'];

  // A role's grant of an (action, subject) permission carries its own,
  // optional row-scoping `condition` on the `RolePermission` row — not on
  // the shared `Permission` row (which stays unique on (action, subject)
  // and unconditioned). Two roles can therefore grant the identical
  // permission with different scope: Employee's `read:time-logs` grant can
  // carry `condition: { employeeId: "$self" }` while Manager's `read:time-logs`
  // grant carries none. `PermissionsGuard` resolves `$self` and builds a CASL
  // `Ability` from these per-grant conditions at request time.
  type Grant = {
    subject: string;
    actions: string[];
    condition?: Prisma.InputJsonValue;
  };
  type ResolvedGrant = {
    permissionId: number;
    condition?: Prisma.InputJsonValue;
  };

  const permIdByKey = new Map(
    allPermissions.map((p) => [`${p.action}:${p.subject}`, p.id] as const),
  );

  const resolveGrants = (grants: Grant[]): ResolvedGrant[] => {
    const resolved: ResolvedGrant[] = [];
    const seenPermissionIds = new Set<number>();
    for (const { subject, actions, condition } of grants) {
      for (const action of actions) {
        const id = permIdByKey.get(`${action}:${subject}`);
        if (id === undefined) {
          throw new Error(
            `Seed: role grant references a permission that was not seeded: ${action}:${subject}`,
          );
        }
        if (seenPermissionIds.has(id)) {
          throw new Error(
            `Seed: role grant references ${action}:${subject} more than once`,
          );
        }
        seenPermissionIds.add(id);
        resolved.push(
          condition ? { permissionId: id, condition } : { permissionId: id },
        );
      }
    }
    return resolved;
  };

  // Subject groups
  const SCHEDULING_SUBJECTS = [
    'master-shift-templates',
    'sub-shift-templates',
    'task-templates',
    'master-shifts',
    'sub-shifts',
    'tasks',
    // Per-branch scheduling config: Manager manages it, Employee reads it.
    'branch-schedule-configs',
  ];
  // Scheduling subjects that carry a direct `branchId` field — the ones
  // Manager's grant below scopes to `$managedBranches` via a simple
  // `{ branchId: { in: '$managedBranches' } }` `RolePermission.condition`.
  // `sub-shifts` and `tasks` have no direct `branchId` (only reachable
  // transitively through their parent `masterShift`/`subShift`), so they're
  // scoped separately below with relation-based conditions instead of being
  // folded into this generic mapping — see the
  // `branch-scope-subshift-task-permissions` change's design.md.
  const BRANCH_SCOPED_SCHEDULING_SUBJECTS = SCHEDULING_SUBJECTS.filter(
    (subject) => subject !== 'sub-shifts' && subject !== 'tasks',
  );
  // `SubShift.masterShiftId` is always set, so its branch is reached via one
  // relation hop.
  const SUB_SHIFT_MANAGED_BRANCH_CONDITION = {
    masterShift: { is: { branchId: { in: '$managedBranches' } } },
  };
  // `Task.masterShiftId`/`Task.subShiftId` are mutually exclusive (shared
  // tasks set the former, dedicated tasks set the latter), so the branch is
  // reached via whichever parent is set.
  const TASK_MANAGED_BRANCH_CONDITION = {
    OR: [
      { masterShift: { is: { branchId: { in: '$managedBranches' } } } },
      {
        subShift: {
          is: { masterShift: { is: { branchId: { in: '$managedBranches' } } } },
        },
      },
    ],
  };
  // Availability and Assignment both carry a required subShiftId (no direct
  // branchId, and — unlike Task — no alternate masterShiftId path), so a
  // single relation chain covers both: subShiftId -> SubShift.masterShiftId
  // -> MasterShift.branchId.
  const SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION = {
    subShift: { is: { masterShift: { is: { branchId: { in: '$managedBranches' } } } } },
  };
  // `assignments` and `availability` are granted explicitly in managerGrants
  // below (branch-scoped via SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION), so
  // they're excluded from this generic, unconditioned group.
  const OPERATIONAL_SUBJECTS = [
    'attendance-history',
    'leave-requests',
    'time-logs',
  ];

  // Admin: everything that exists, unconditioned.
  const adminGrants: ResolvedGrant[] = allPermissions.map((p) => ({
    permissionId: p.id,
  }));

  // Manager: runs scheduling + day-to-day operations, edits people, but has NO
  // access to the RBAC/admin subjects (users, roles, permissions,
  // role-permissions) and cannot create/delete branches or pay rates.
  // check-in/check-out are self-only for every role that holds them (an
  // actor can only check *themselves* in/out), so Manager's grant of those
  // two actions carries the same `$self` condition Employee's does.
  //
  // Branch scoping: Manager's CRUD grant on branch-scoped scheduling
  // subjects (BRANCH_SCOPED_SCHEDULING_SUBJECTS) carries
  // `condition: { branchId: { in: '$managedBranches' } }`, so a Manager only
  // reads/writes rows for branches they're assigned via `ManagerBranch` —
  // without this, any Manager could read and mutate every branch's data.
  // `sub-shifts`/`tasks` use their own relation-based conditions above (no
  // direct `branchId`), and `employees` uses one below for the same reason.
  // NOTE: as with `employees` below, this condition currently only has
  // effect on `read` (`findAll`/`findOne` apply `accessibleWhere`) —
  // `create`/`update`/`delete` are not yet instance-checked; see design.md
  // Non-Goals on both the original and this follow-up change.
  const managerGrants = resolveGrants([
    ...BRANCH_SCOPED_SCHEDULING_SUBJECTS.map((subject) => ({
      subject,
      actions: CRUD,
      condition: { branchId: { in: '$managedBranches' } },
    })),
    {
      subject: 'sub-shifts',
      actions: CRUD,
      condition: SUB_SHIFT_MANAGED_BRANCH_CONDITION,
    },
    {
      subject: 'tasks',
      actions: CRUD,
      condition: TASK_MANAGED_BRANCH_CONDITION,
    },
    // Availability and assignments both reach their branch via
    // subShiftId -> SubShift.masterShiftId -> MasterShift.branchId, so they
    // share SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION. Manager keeps full CRUD
    // on assignments (unchanged), but availability is read-only for Manager
    // — Availability.status is flipped to ASSIGNED internally by
    // AssignmentsService.create(), not through the /availability endpoints,
    // so Manager never needs direct write access there.
    {
      subject: 'assignments',
      actions: CRUD,
      condition: SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION,
    },
    {
      subject: 'availability',
      actions: ['read'],
      condition: SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION,
    },
    // attendance-history, leave-requests, time-logs stay in
    // OPERATIONAL_SUBJECTS, unconditioned, exactly as today — out of scope
    // for this change, see the expose-manager-availability-view proposal's
    // Non-Goals.
    ...OPERATIONAL_SUBJECTS.map((subject) => ({ subject, actions: CRUD })),
    { subject: 'branches', actions: ['read'] },
    {
      subject: 'employees',
      actions: ['create', 'read', 'update'],
      // Scopes `read`/`update` query filtering (via `accessibleWhere`) to
      // employees with an `EmployeeBranch` row in a managed branch. Has no
      // effect on `create`: `EmployeeService.create` performs no
      // instance-level `ability.can()` check today, so this condition
      // cannot yet block a Manager from creating an employee in a branch
      // they don't manage — a known limitation, see design.md Non-Goals.
      condition: {
        employeeBranches: { some: { branchId: { in: '$managedBranches' } } },
      },
    },
    { subject: 'employee-hourly-rates', actions: ['read'] },
    // Managers may award a discretionary bonus on a payroll entry, but get no
    // other payroll-entries/pay-periods access (unconditioned, same shape as
    // Admin's grant — see expose-employee-facing-earnings-summary design.md).
    { subject: 'payroll-entries', actions: ['update'] },
    // Custom actions: managers oversee the full operational lifecycle.
    {
      subject: 'assignments',
      actions: ['check-in', 'check-out'],
      condition: { employeeId: '$self' },
    },
    { subject: 'leave-requests', actions: ['approve', 'cancel'] },
    { subject: 'time-logs', actions: ['verify'] },
    { subject: 'master-shifts', actions: ['generate'] },
    { subject: 'tasks', actions: ['complete'] },
    // Any caller may upload a file (e.g. task-completion evidence) —
    // nothing to scope against yet, so unconditioned.
    { subject: 'uploads', actions: ['create'] },
  ]);

  // Employee: reads the schedule and does self-service writes via dedicated
  // actions (check-in/check-out, cancel own leave, complete tasks). Withheld:
  // employee-hourly-rates (pay privacy), the RBAC/admin subjects, the privileged
  // actions (approve/verify/generate), and the coarse `update` on
  // assignments/leave-requests/time-logs (which would allow editing/reassigning
  // any record — deferred to row-level scoping).
  //
  // Row-scoped grants: read/create/cancel on time-logs, leave-requests,
  // assignments, availability, attendance-history, and payroll-entries are
  // the plain action with a `$self` condition on Employee's `RolePermission`
  // row (Manager's/Admin's grants of the same actions carry no condition,
  // since they resolve to a *different* RolePermission row pointing at the
  // same Permission). See openspec/changes/adopt-casl-authorization/design.md
  // (D1).
  const employeeGrants = resolveGrants([
    { subject: 'branches', actions: ['read'] },
    { subject: 'employees', actions: ['read'] },
    ...SCHEDULING_SUBJECTS.map((subject) => ({ subject, actions: ['read'] })),
    {
      subject: 'assignments',
      actions: ['read'],
      condition: { employeeId: '$self' },
    },
    {
      subject: 'assignments',
      actions: ['check-in', 'check-out'],
      condition: { employeeId: '$self' },
    },
    {
      subject: 'availability',
      actions: ['read', 'create', 'update', 'delete'],
      condition: { employeeId: '$self' },
    },
    {
      subject: 'attendance-history',
      actions: ['create', 'read'],
      // `is` is required (not the implicit-object shorthand) for CASL's own
      // condition matcher to evaluate this as a to-one relation filter
      // during an instance-level `ability.can()` check — the implicit form
      // only works when Prisma itself interprets the where clause (e.g. via
      // accessibleBy), not when @casl/prisma's matcher does.
      condition: { assignment: { is: { employeeId: '$self' } } },
    },
    {
      subject: 'leave-requests',
      actions: ['create', 'read', 'cancel'],
      condition: { absenceEmployeeId: '$self' },
    },
    {
      subject: 'time-logs',
      actions: ['create', 'read'],
      condition: { employeeId: '$self' },
    },
    { subject: 'tasks', actions: ['complete'] },
    {
      subject: 'payroll-entries',
      actions: ['read'],
      condition: { employeeId: '$self' },
    },
    // Any employee may upload a file (e.g. task-completion evidence) —
    // nothing to scope against yet, so unconditioned.
    { subject: 'uploads', actions: ['create'] },
  ]);

  // 3) Upsert roles and assign permissions
  const rolesSeed: Array<{
    name: string;
    description?: string;
    grants: ResolvedGrant[];
  }> = [
    {
      name: 'Admin',
      description: 'System administrator with full access',
      grants: adminGrants,
    },
    {
      name: 'Manager',
      description:
        'Runs scheduling and operations; manages employees; no access to RBAC/admin subjects',
      grants: managerGrants,
    },
    {
      name: 'Employee',
      description: 'Reads the schedule and performs self-service writes',
      grants: employeeGrants,
    },
  ];

  for (const role of rolesSeed) {
    await prisma.role.upsert({
      where: { name: role.name }, // assumes unique on name
      create: {
        name: role.name,
        description: role.description || '',
        // All three seeded roles (Admin, Manager, Employee) are the base,
        // system-protected role set — see the "role-permission-conditions"
        // capability's isSystemRole requirement.
        isSystemRole: true,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
        rolePermissions: {
          create: role.grants.map(({ permissionId, condition }) => ({
            permission: {
              connect: {
                id: permissionId,
              },
            },
            ...(condition ? { condition } : {}),
          })),
        },
      },
      update: {
        description: role.description,
        isSystemRole: true,
        updatedBy: SYSTEM_USER_ID,
        rolePermissions: {
          deleteMany: {},
          create: role.grants.map(({ permissionId, condition }) => ({
            permission: {
              connect: {
                id: permissionId,
              },
            },
            ...(condition ? { condition } : {}),
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

  await prisma.user.upsert({
    where: { phoneNumber: SETTINGS_USERNAME },
    update: {
      password: hashed,
      status: 'ACTIVE',
      userRoles: {
        deleteMany: {},
        create: [{ roleId: adminRole.id }],
      },
    },
    create: {
      id: SYSTEM_USER_ID,
      phoneNumber: SETTINGS_USERNAME,
      fullName: 'Settings User',
      password: hashed,
      status: 'ACTIVE',
      userRoles: {
        create: [{ roleId: adminRole.id }],
      },
    },
    include: {
      userRoles: { include: { role: true } },
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
      userRoles: {
        deleteMany: {},
        create: [{ roleId: employeeRole.id }],
      },
    },
    create: {
      id: DEV_USER_ID,
      phoneNumber: DEV_EMPLOYEE_PHONE,
      fullName: DEV_EMPLOYEE_NAME,
      password: devPasswordHash,
      status: 'ACTIVE',
      userRoles: {
        create: [{ roleId: employeeRole.id }],
      },
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

  // The SETTINGS/dev users above are upserted with explicit ids
  // (SYSTEM_USER_ID/DEV_USER_ID), which never advances Postgres's identity
  // sequence for `users.id` (only inserts using the column default do).
  // Without this, the very first `POST /users` after a fresh seed collides
  // on the primary key. Idempotent and safe to run on every seed.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`,
  );

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

  .finally(async () => {
    await prisma.$disconnect();
  });
