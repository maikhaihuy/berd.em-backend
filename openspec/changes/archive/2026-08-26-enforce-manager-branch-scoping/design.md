## Context

`RolePermission.condition` and the `$managedBranches` token resolution
mechanism are fully implemented (`managed-branch-scoping` capability,
`CaslAbilityFactory`, `permission-condition.helper.ts`). Nothing here
changes that resolution mechanism. The gap has two parts, only one of
which was caught before this change's first archive attempt:

1. `prisma/seed.ts`: the seeded `Manager` role's grants for scheduling
   subjects, `employees`, and `branches` carried no `condition`, so every
   Manager had unscoped access to every branch's data.
2. **(Found during pre-archive verification, addressed in tasks.md §7)**
   Even with the condition set, five of the six affected services —
   `EmployeeService`, `BranchScheduleConfigService`,
   `MasterShiftTemplatesService`, `SubShiftTemplatesService`,
   `TaskTemplatesService` — had no `accessibleWhere`/CASL ability filtering
   in their `findAll`/`findOne` at all (only `master-shifts` did, wired in
   the earlier `rbac-multi-role-managed-branches` change). Setting the
   condition alone is inert without a service that consults the built
   `Ability` when querying — the condition would resolve correctly (visible
   via `GET /users/:id/abilities`) while the actual list/detail endpoints
   stayed fully unfiltered. Both parts are needed for the fix to be real;
   this change now closes both.

## Goals / Non-Goals

**Goals:**
- Seed the `Manager` role's grants for every branch-scheduling subject that
  has a direct `branchId` field (`branch-schedule-configs`,
  `master-shift-templates`, `sub-shift-templates`, `task-templates`,
  `master-shifts`) with `condition: { branchId: { in: '$managedBranches' } }`.
- Seed the `Manager` role's grant of `employees` with a relation-based
  condition (`{ employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }`),
  since `Employee` has no direct `branchId`.
- Update `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS`
  (`permission-condition.helper.ts`) so `GET /permissions/catalog` documents
  `employees` as `$managedBranches`-scopable, keeping the catalog in sync
  with the seed (per the existing "catalog can't drift from the resolver"
  convention — this constant is documentation only, not enforced by the
  resolver).
- Wire `accessibleWhere(ability, 'read', <subject>)` into `findAll`/
  `findOne` (and, for `BranchScheduleConfigService`, `findByBranch`) on all
  five newly-scoped services, and thread `@CaslAbility()` through their
  controllers — mirroring the existing `master-shifts` pattern — so the
  seeded condition is actually enforced, not just resolvable.
- Extend `rbac-multi-role-managed-branches.e2e-spec.ts` to assert the
  *seeded* Manager role (not just a test-created role) is scoped.

**Non-Goals:**
- `sub-shifts` and `tasks` are **not** scoped by this change. Neither model
  has a direct `branchId` — it's reachable only transitively through
  `masterShift.branchId` (or `subShift.masterShift.branchId` for tasks
  attached to a sub-shift). Scoping them needs a nested-relation condition
  and, per the existing `is`-vs-shorthand caveat documented in
  `CLAUDE.md`/`authorization` spec for to-one relations, may hit the same
  `@casl/prisma` instance-matcher limitation called out below. Left for a
  follow-up change; the existing `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS`
  catalog already excludes them today, so this isn't a regression.
- The `branches` subject itself stays unconditioned for Manager
  (`{ subject: 'branches', actions: ['read'] }` unchanged). A Manager still
  reads the full branch list — e.g. for a branch picker — independent of
  which branches they manage. Reading the org's branch directory and
  managing a branch's data are treated as separate concerns; the proposal's
  "What Changes" section scopes only the scheduling subjects and
  `employees`.
- No change to `EmployeeService.create`, `.update`, or `.remove` (or the
  equivalent write paths on the other four newly-scoped services). None of
  them perform an instance-level `ability.can()` check today (unlike
  `assignments`/`leave-requests`/etc, which validate a create payload's
  self-owned field against the caller's ability). `accessibleWhere` only
  wires into `findAll`/`findOne` (list/detail reads) — the same convention
  every other row-scoped subject in this codebase already follows (see the
  `authorization` spec's "Row-scoped subjects apply CASL `accessibleBy`
  filters" requirement, and e.g. `TimeTrackingService.update`, which also
  has no ability check). So the `employees` condition scopes `read` only;
  a Manager can still create or update an `Employee` (or a scheduling-
  subject row) outside their managed branches via `update`/`create`.
  Documented as a known limitation, not silently worked around, since
  adding instance-level write checks is new scope inconsistent with the
  rest of the codebase's established pattern, not something this change's
  stated scope (`prisma/seed.ts` + the e2e spec, later extended to also
  wire `accessibleWhere` into the five services' read paths — see tasks.md
  §7) covers.
- No migration/backfill script for already-deployed databases. `seed.ts` is
  idempotent (`upsert` on role, condition is part of the create/update
  payload) but only re-runs on `db:seed`/`db:reset` — it does not retroactively
  patch a live database's existing `RolePermission` rows. Flagged as an open
  question below.

## Decisions

**D1 — One condition value covers all actions in a grant, including `create`.**
`resolveGrants`'s `Grant` type attaches one `condition` to a whole
`{ subject, actions }` entry, and Manager's `employees` grant is
`{ subject: 'employees', actions: ['create', 'read', 'update'] }` — a single
entry. Splitting `create` into its own unconditioned entry (to make the
"no instance-level check" non-goal explicit at the seed level) was
considered, but `PermissionsGuard`'s route check is type-level only
(`ability.can(action, subject)`, no instance data) — see `CLAUDE.md`'s
Authorization section — so a `condition` on the `create` action is inert
today regardless of whether it's declared. Keeping one entry matches the
existing pattern for `availability` and other multi-action grants and
avoids an unnecessary seed-file split. Reflected in code comments in
`seed.ts`, not a behavior difference.

**D2 — `employees` uses a `some` relation filter, not a `some`-free equivalent.**
`{ employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }` is
plain Prisma `where` syntax once `$managedBranches` resolves to an id array,
so `accessibleWhere()` (query-time filtering via `accessibleBy`) handles it
with no code changes — `resolveCondition` already resolves tokens anywhere
in the tree regardless of key name (unlike `$self`, which is keyed off the
enclosing field name). No new resolver logic needed.

**D3 — Catalog field name for `employees` is a dotted path, not a bare field.**
Every existing `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS` entry lists a bare
`branchId` because those subjects have the field directly. `employees`
doesn't, so its catalog entry is documented as
`['employeeBranches.branchId']` — descriptive text for `GET
/permissions/catalog` consumers (the frontend condition editor), not a
field name any resolver code parses or validates.

## Risks / Trade-offs

- **[Risk]** A Manager with zero `ManagerBranch` rows (the common case right
  after this change ships, until an admin explicitly assigns managed
  branches) will see empty scheduling lists and an empty employee list —
  a sudden, sharp access reduction for any Manager who previously relied on
  the unscoped grant. → **Mitigation**: this is the intended fix, not a bug,
  but call it out explicitly in the PR/rollout notes so it isn't reported as
  a regression; `ManagerBranch` assignment (`POST /users/:id/manager-branches`)
  already exists and is an admin action, not new work.
- **[Risk]** `employees` scoping only covers `read` query filtering, not
  `create`/`update` (see Non-Goals) — a Manager can still create or edit an
  employee's branch assignments outside their managed set, and would then
  immediately lose the ability to see or further edit that employee via the
  now-filtered `read`. → **Mitigation**: documented as a known follow-up;
  not silently accepted as fine, just out of this change's stated scope.
- **[Trade-off]** Leaving `sub-shifts`/`tasks`/`branches` unscoped means this
  change closes the most visible part of the gap (the Why section's
  concrete complaint: full read/write on every branch's core scheduling
  data) without claiming full branch isolation. A Manager can still, e.g.,
  read/write `tasks` rows for shifts in branches they don't manage. → Tracked
  as a Non-Goal above rather than silently expanded scope creep.

## Migration Plan

- No schema migration. This is a `prisma/seed.ts` data-shape change plus a
  documentation-constant update in application code.
- Rollout: re-run `pnpm db:seed` (or `db:reset` in dev) so the `Manager`
  role's `RolePermission.condition` values are refreshed with the new
  scoping. Confirmed in `seed.ts`'s `role.upsert` (`update` branch, lines
  ~429-444): it does `rolePermissions: { deleteMany: {}, create: [...] }`,
  i.e. it fully replaces a role's `RolePermission` rows on every re-run —
  running `db:seed` against an already-seeded, deployed database *does*
  pick up the new conditions, no separate backfill script needed.
- Rollback: re-run seed from the previous `seed.ts` revision (the same
  `deleteMany`-then-recreate behavior restores the unconditioned grants),
  or manually clear the `condition` column on the affected
  `RolePermission` rows.

## Open Questions

None outstanding — the only open item from the proposal (whether re-seeding
updates an already-deployed database) is resolved above: it does.
