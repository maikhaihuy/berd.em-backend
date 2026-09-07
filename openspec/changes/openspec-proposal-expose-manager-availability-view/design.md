## Context

`AvailabilityService.findAll()`/`findOne()` (`src/modules/availability/availability.service.ts`)
hard-code every query to the *calling* user's own `Employee` row via a
private `getCurrentUserEmployee(currentUserId)` helper, regardless of what
the caller's CASL grant would otherwise allow. This is the only scheduling
service in the codebase that still does manual self-filtering instead of
merging `accessibleWhere(ability, action, SUBJECT)` into the Prisma `where`
— every sibling (`AssignmentsService`, `MasterShiftsService`, `TasksService`)
already delegates row-scoping entirely to the resolved `Ability`. That gap
means there is currently no way for a Manager to see anyone's availability
but their own, which blocks the "manager builds the week from registered
availability" workflow the data model (`Availability`, `BranchScheduleConfig`,
`Assignment.availabilityId`) already supports end to end on the employee
side.

Fixing the self-filter naively — just deleting it — would also reopen an
adjacent hole: the seeded `Manager` role's grants on `availability` and
`assignments` (in `prisma/seed.ts`'s `OPERATIONAL_SUBJECTS` block) carry no
branch condition at all, unlike the already-scoped
`BRANCH_SCOPED_SCHEDULING_SUBJECTS` group (`sub-shifts`, `tasks`,
`employees`, etc., see the existing `managed-branch-scoping` capability).
An unscoped fix would let a Manager see every branch's availability and
assignments, not just branches they manage.

## Goals / Non-Goals

**Goals:**
- Let a Manager list and fetch `Availability` rows for employees in
  branches they manage, through the existing `GET /availability` /
  `GET /availability/:id` endpoints, using the same CASL-driven
  `accessibleWhere` pattern every sibling scheduling service already uses.
- Close the branch-scoping gap on `assignments` at the same time, since it
  shares the exact same unconditioned-grant problem and the exact same
  relation chain to a branch (`subShiftId` → `SubShift.masterShiftId` →
  `MasterShift.branchId`).
- Narrow Manager's `availability` grant to `read`-only — Manager never needs
  direct write access; `AssignmentsService.create()` already flips
  `Availability.status` internally.
- Fix the pre-existing missing-ownership-check bug in
  `AvailabilityService.remove()` (it never checked ownership at all) as part
  of touching this file, using the same instance-level `ability.can(...)`
  pattern `AssignmentsService.checkIn()`/`checkOut()` already use, rather
  than reintroducing a manual employee-id comparison.

**Non-Goals:**
- No shift-change/swap/substitute-coverage requests.
- No hard server-side validation blocking a Manager from assigning outside
  declared availability.
- No recurring/template availability, no submission deadline/lock, no
  reminder notifications.
- No new "2-hour block" entity — granularity stays whatever the branch's
  `SubShift`s are.
- No branch-scoping fix for `attendance-history` / `leave-requests` /
  `time-logs` — same unconditioned-grant issue exists there, but it's a
  separate feature surface; left for a follow-up proposal.
- No change to `POST /master-shifts/generate` or any weekly
  auto-generation.
- No Prisma migration — every change is service logic plus one seed-data
  edit.

## Decisions

**Delegate all row-scoping to the CASL grant; delete the manual self-filter
outright, rather than branching on role.** Every sibling scheduling service
already resolves visibility purely from `accessibleWhere(ability, action,
SUBJECT)`; keeping `AvailabilityService` as a special case that branches
on "is this caller a Manager or Employee" would both duplicate logic
CASL already provides and drift out of sync as roles evolve. Once Manager's
grant is correctly branch-scoped (see next decision), simply removing the
hard-coded filter is sufficient: an Employee's own `$self`-conditioned grant
continues to restrict them to their own rows with no special-casing needed
in the service.

**Reuse one relation-chain condition constant for both `assignments` and
`availability`, rather than writing two.** Both models reach their branch
through the identical path — a required `subShiftId` → `SubShift.masterShiftId`
→ `MasterShift.branchId` — one hop deeper than `SubShift`'s own
`SUB_SHIFT_MANAGED_BRANCH_CONDITION`. A single
`SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION` constant in `prisma/seed.ts`,
reused for both grants, keeps the two subjects' scoping mechanically
identical and avoids the two conditions silently drifting apart over time.

**Make Manager's `availability` grant `read`-only instead of full CRUD.**
Today `availability` sits in `OPERATIONAL_SUBJECTS`, which grants full CRUD
with no condition. Auditing actual usage shows Manager never needs
`create`/`update`/`delete` here directly — `AssignmentsService.create()`
already transitions `Availability.status` to `ASSIGNED` internally, inside
its own transaction, not through the `/availability` endpoints. Narrowing to
`read` is a genuine least-privilege improvement bundled with the scoping
fix, not a separate change — doing both in the same seed edit avoids a
second migration/rollout pass.

**Fix `remove()`'s missing ownership check with an instance-level CASL
check, not a manual comparison.** `update()` already manually compares
`availability.employeeId !== employee.id`; `remove()` currently has no such
check at all — any authenticated Employee can delete any `Availability` row
today. Since Manager no longer holds `delete:availability` after the seed
change (only `Admin`, unconditioned, does), the correct fix is
`ability.can('delete', subject(SUBJECT, availability))`, mirroring the
pattern `AssignmentsService.checkIn()`/`checkOut()` already use, rather than
reintroducing a second manual employee-id branch that would need to also
special-case Admin.

**Return `404`, not `403`, when `DELETE /availability/:id` is denied.**
Matches the existing not-found-for-forbidden convention already used
elsewhere in this codebase (e.g. `findAssignmentOrThrow`), so a caller can't
distinguish "doesn't exist" from "exists but isn't yours" by response code.

**Add `subShiftId` as a query parameter, not a separate endpoint.** The
Manager-side "who's free for this shift" use case (populating an
`Assignment` creation dialog) is a narrowing of the same list, not a
different resource — consistent with how `branchId` is added as an optional
filter rather than a new route.

## Risks / Trade-offs

- **[Risk] Narrowing Manager's `availability` grant from full CRUD to
  read-only is a live authorization change on an already-deployed role.**
  → Mitigation: audited that no current frontend code calls
  `POST`/`PATCH`/`DELETE /availability` as a Manager today (the manager-side
  screen doesn't exist yet), so there is no live caller to break. Flagged in
  the proposal's rollout note as needing the same reseed/backfill care as
  prior branch-scoping proposals (roles/permissions aren't
  auto-migrated — a seed script re-run or equivalent backfill is required
  on already-deployed databases).
- **[Risk] Removing the hard-coded self-filter and relying entirely on the
  seed-time condition means a future seed misconfiguration (e.g. forgetting
  the condition on a re-grant) would silently over-expose availability data
  across branches.** → Mitigation: this is the same trust model every
  sibling scheduling subject already operates under (no additional risk
  introduced beyond what `sub-shifts`/`tasks`/`master-shifts` already
  accept), and `GET /permissions/catalog` plus `GET /users/:id/abilities`
  make a misconfigured grant auditable/visible rather than silent.
- **[Trade-off] `subShiftId` and `branchId` are both optional and can be
  combined or omitted independently** — no validation ties them together
  (e.g. requiring `branchId` when `subShiftId` is set). Accepted as
  consistent with how filters compose elsewhere in this codebase; CASL
  scoping is the actual security boundary regardless of which filters the
  caller supplies.

## Migration Plan

No Prisma migration. Rollout is a seed/permission-data change plus a code
deploy:

1. Ship the `prisma/seed.ts` grant changes (new
   `SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION`, `availability` moved out of
   `OPERATIONAL_SUBJECTS` to a read-only branch-scoped grant, `assignments`
   given the same branch condition) and the service/controller changes in
   one PR — they're the same feature and the service change alone (without
   the seed change) would be a real over-exposure regression.
2. On deploy, re-run the permission seed step (or equivalent backfill) so
   already-deployed `RolePermission` rows for `Manager` pick up the new
   condition and the narrowed action set — editing `seed.ts` alone does not
   retroactively update rows already written to a live database.
3. No rollback data concerns (no destructive schema change); reverting the
   PR and re-running the seed step restores the prior unconditioned grant if
   ever needed.

## Open Questions

None outstanding — proposal, capabilities, and API shape are settled per
the finalized spec in `proposal.md`. Item #5 there (branch-membership check
on `AvailabilityService.create()`) is explicitly deferred as optional/low
priority, not an open question blocking this change.
