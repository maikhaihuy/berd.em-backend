# `expose-manager-availability-view` — final backend spec (v1)

Status: ready to implement. Supersedes the sketch in the "Suggested next proposal" section of
`claude/backend-availability-scheduling-gap-2026-09-07.md` — this is the fully-specced version of
that sketch, checked against the real `develop` code (`bf2beaf`) and the corrected domain model
(a `SubShift` is a role/duty subdivision of a `MasterShift`, can be shorter than 2h or longer, and
multiple `SubShift`s of the same `MasterShift` can overlap in time — it is not a 2-hour block).

No Prisma migration needed. Every change below is service logic + one seed-permission edit.

---

## Why

The data model for "employee registers availability, manager builds the week from it" already
exists (`Availability`, `BranchScheduleConfig`, `Assignment.availabilityId`) and the employee
self-service side already works end to end. The one missing piece: **no endpoint lets a Manager
see anyone's availability but their own** — `AvailabilityService.findAll()`/`findOne()`
(`src/modules/availability/availability.service.ts`) hard-code the query to the *calling* user's
own `Employee` row, regardless of what their CASL grant would otherwise allow. Fixing that
naively would also re-open an adjacent hole: Manager's current grant on `availability` (and
`assignments`) carries no branch scoping at all, so an unscoped fix would let a Manager see every
branch's data, not just branches they manage.

## Non-Goals (unchanged from the original feature ask)

- No shift-change / swap / substitute-coverage requests.
- No hard server-side validation blocking a Manager from assigning outside declared availability.
- No recurring/template availability, no submission deadline/lock, no reminder notifications.
- No new "2-hour block" entity — availability granularity stays whatever the branch's `SubShift`s
  are (see domain correction above). If literal block-level registration independent of
  `SubShift` is ever wanted, that's a separate, bigger proposal — not this one.
- No branch-scoping fix for `attendance-history` / `leave-requests` / `time-logs` (same
  unconditioned-Manager-grant issue exists there too, but it's a different feature surface —
  recommend a separate follow-up proposal, not bundled here).
- No change to `POST /master-shifts/generate` or any weekly auto-generation — still manual,
  matches the existing "keep it simple" scope.

## What Changes

### 1. `AvailabilityService.findAll()` / `findOne()` — drop the hard-coded self-filter

Today, both methods call a private `getCurrentUserEmployee(currentUserId)` that throws
`ForbiddenException` if the caller has no linked `Employee`, then hard-code
`employeeId: employee.id` into the Prisma `where`. This is inconsistent with every sibling
service (`AssignmentsService.findAll`, `MasterShiftsService.findAll`) which just merge
`accessibleWhere(ability, 'read', SUBJECT)` into the query and let the CASL grant (resolved from
`prisma/seed.ts`, `$self` included) decide what's visible. `$self` is already resolved server-side
per request (see the seed.ts comment on `PermissionsGuard`), so once Manager's grant is correctly
branch-scoped (change #2 below), simply removing the manual filter is enough — no per-role
branching logic needed in the service at all:

```ts
// findAll — after
async findAll(
  from: Date,
  to: Date,
  ability: AppAbility,
  branchId?: number,
  subShiftId?: number,
): Promise<AvailabilityResponseDto[]> {
  const availabilities = await this.prisma.availability.findMany({
    where: {
      subShift: {
        startTime: { gte: from },
        endTime: { lte: to },
        ...(branchId ? { masterShift: { branchId } } : {}),
      },
      ...(subShiftId ? { subShiftId } : {}),
      AND: [accessibleWhere(ability, 'read', SUBJECT)],
    },
    include: availabilityWithEmployeeInclude,
    orderBy: { subShift: { startTime: 'asc' } },
  });
  return AvailabilityMapper.toDtos(availabilities);
}

// findOne — after
async findOne(id: number, ability: AppAbility): Promise<AvailabilityResponseDto> {
  const availability = await this.prisma.availability.findFirst({
    where: { id, AND: [accessibleWhere(ability, 'read', SUBJECT)] },
    include: availabilityWithEmployeeInclude,
  });
  if (!availability) throw new NotFoundException('Availability not found');
  return AvailabilityMapper.toDto(availability);
}
```

`currentUserId` is no longer needed by either method — drop it from both signatures and their
controller call sites. This is the key design payoff: an Employee calling `GET /availability`
still only ever sees their own rows (their grant's `$self` condition enforces that on its own),
and a Manager calling the *same* endpoint with `?branchId=` now sees everyone's, scoped to
branches they manage — no role-specific code path, the permission grant does the work.

### 2. Controller — add `branchId` and `subShiftId` query params

`src/modules/availability/availability.controller.ts`:

```ts
@Get()
findAll(
  @CaslAbility() ability: AppAbility,
  @Query('date', new ParseDatePipe({ optional: true })) date?: string,
  @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
  @Query('subShiftId', new ParseIntPipe({ optional: true })) subShiftId?: number,
) {
  // ...existing startOfWeek/endOfWeek computation from `date`, unchanged...
  return this.availabilityService.findAll(startOfWeek, endOfWeek, ability, branchId, subShiftId);
}

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number, @CaslAbility() ability: AppAbility) {
  return this.availabilityService.findOne(id, ability);
}
```

`@AuthenticatedUser()` can be dropped from both handlers too, since neither service method needs
`currentUserId` anymore.

### 3. `prisma/seed.ts` — narrow and branch-scope Manager's `availability`/`assignments` grants

Today `availability` and `assignments` sit in `OPERATIONAL_SUBJECTS`, granted full CRUD to
Manager with **no** condition at all (unlike `BRANCH_SCOPED_SCHEDULING_SUBJECTS`, already fixed by
proposals G/P). Two changes, same root cause:

- **Pull `availability` out of `OPERATIONAL_SUBJECTS`** and give Manager `read`-only on it,
  branch-scoped. Manager never needs `create`/`update`/`delete` on `Availability` directly —
  `AssignmentsService.create()` already flips `Availability.status` to `ASSIGNED` internally via
  its own transaction, not through the `/availability` endpoints. Keeping Manager's access
  read-only here is a real least-privilege improvement, not just a scoping fix.
- **Add the same branch condition to `assignments`**, which stays full CRUD for Manager (that
  part is correct and unchanged) but currently has no branch scoping either — a live gap today,
  since `AssignmentsService.findAll()` already applies `accessibleWhere`.

Both `Availability` and `Assignment` reach their branch the same way — a required `subShiftId` →
`SubShift.masterShiftId` → `MasterShift.branchId` — one hop deeper than `SubShift`'s own condition
(`SUB_SHIFT_MANAGED_BRANCH_CONDITION`), so define one new constant and reuse it for both:

```ts
// New, alongside SUB_SHIFT_MANAGED_BRANCH_CONDITION / TASK_MANAGED_BRANCH_CONDITION:
// Availability and Assignment both carry a required subShiftId (no direct branchId,
// and — unlike Task — no alternate masterShiftId path), so a single relation chain covers both.
const SUBSHIFT_LINKED_MANAGED_BRANCH_CONDITION = {
  subShift: { is: { masterShift: { is: { branchId: { in: '$managedBranches' } } } } },
};
```

```ts
// OPERATIONAL_SUBJECTS: remove 'availability' from this list.
const OPERATIONAL_SUBJECTS = [
  'assignments',
  'attendance-history',
  'leave-requests',
  'time-logs',
];
```

```ts
// managerGrants: replace the blanket OPERATIONAL_SUBJECTS.map(...) entry for 'assignments'
// with an explicit, branch-scoped one, and add the new read-only 'availability' grant.
const managerGrants = resolveGrants([
  ...BRANCH_SCOPED_SCHEDULING_SUBJECTS.map((subject) => ({ /* unchanged */ })),
  { subject: 'sub-shifts', actions: CRUD, condition: SUB_SHIFT_MANAGED_BRANCH_CONDITION },
  { subject: 'tasks', actions: CRUD, condition: TASK_MANAGED_BRANCH_CONDITION },
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
  // attendance-history, leave-requests, time-logs stay in OPERATIONAL_SUBJECTS,
  // unconditioned, exactly as today — out of scope for this change, see Non-Goals.
  ...OPERATIONAL_SUBJECTS.map((subject) => ({ subject, actions: CRUD })),
  ...(/* everything else below this point: unchanged */),
]);
```

Employee's own grants are untouched — `{ subject: 'availability', actions: ['read','create','update','delete'], condition: { employeeId: '$self' } }`
stays exactly as-is and continues to be the only thing an Employee needs.

**Rollout note** (same caveat proposal G already flagged): reseeding role/permission rows on an
already-deployed database needs a backfill step, not just editing `seed.ts` — this narrows an
existing role's grant (removing Manager's `create`/`update`/`delete` on `availability`), so
confirm no already-running client depends on a Manager directly calling those endpoints today
(per this audit, none of the current frontend code does, since the manager-side screen doesn't
exist yet).

### 4. `AvailabilityService.remove()` — fix the missing ownership check

`update()` already checks `availability.employeeId !== employee.id` and throws Forbidden;
`remove()` currently doesn't check at all. Since Manager no longer holds `delete:availability`
after change #3 (Admin still does, unconditioned), the correct fix is an instance-level CASL
check — the same pattern `AssignmentsService.checkIn()`/`checkOut()` already uses — rather than
another manual employee-id comparison:

```ts
import { subject } from '@casl/ability';
// ...
async remove(id: number, currentUserId: number, ability: AppAbility): Promise<{ message: string }> {
  const availability = await this.prisma.availability.findUnique({ where: { id } });
  if (!availability) throw new NotFoundException('Availability not found');

  if (!ability.can('delete', subject(SUBJECT, availability))) {
    throw new NotFoundException('Availability not found'); // same not-found-for-403 convention as assignment.service.ts
  }

  await this.prisma.availability.delete({ where: { id } });
  await this.auditLogsService.record({ /* unchanged */ });
  return { message: 'Availability deleted successfully' };
}
```

Controller's `@Delete(':id')` handler needs `@CaslAbility() ability: AppAbility` added and passed
through.

### 5. (Optional, low priority — not required to ship this change) `create()` branch-membership check

`AvailabilityService.create()` only checks the target `SubShift` exists, not that it belongs to a
branch the employee is actually assigned to (`EmployeeBranch`). Low risk (self-registration, no
cross-employee exposure), safe to defer. If picked up later: after loading `subShift`, verify
`prisma.employeeBranch.findUnique({ where: { employeeId_branchId: { employeeId, branchId: subShift.masterShift.branchId } } })`
exists, else `BadRequestException`.

## Capabilities

**Modified:** `manager-availability-visibility` — a Manager can now read (never write) every
employee's registered availability for branches they manage, via the existing `/availability`
endpoint plus `branchId`; previously this was invisible to anyone but the registering employee.
**Modified:** `managed-branch-scoping` — extended to `assignments` and `availability` (previously
only covered the `BRANCH_SCOPED_SCHEDULING_SUBJECTS`/`sub-shifts`/`tasks`/`employees` group).

## API Specification

`GET /availability?date=2026-09-14&branchId=3`

Same response shape as today (`AvailabilityResponseDto[]`, unchanged — `availabilityWithEmployeeInclude`
already returns the full `SubShift` record, including its own `startTime`/`endTime`/`title`/`type`,
plus the parent `MasterShift`'s `branchId`/`workDate`/`title` — enough for the frontend to place
each registration on a timeline, including overlapping `SubShift`s within the same day). Example:

```json
[
  {
    "id": 41,
    "employeeId": 7,
    "subShiftId": 118,
    "startTime": null,
    "endTime": null,
    "status": "REGISTERED",
    "note": null,
    "employee": { "id": 7, "fullName": "Nguyễn Thị B", "phoneNumber": "0901..." },
    "subShift": {
      "id": 118,
      "title": "Pha chế",
      "type": "MAIN",
      "startTime": "2026-09-14T06:00:00.000Z",
      "endTime": "2026-09-14T14:00:00.000Z",
      "masterShift": { "id": 55, "title": "Ca sáng", "branchId": 3, "workDate": "2026-09-14" }
    }
  }
]
```

- Called by an Employee (no `branchId`, or any `branchId`): always their own rows only —
  enforced by their `$self`-conditioned grant, regardless of query params.
- Called by a Manager with `branchId` set to a branch they manage: every employee's registrations
  for that branch/week.
- Called by a Manager with `branchId` set to a branch they do **not** manage: empty list (CASL
  condition excludes it) — not a 403, consistent with how `master-shifts`/`assignments` already
  behave for out-of-scope branches.
- `subShiftId` (either role): narrows further to one specific slot — e.g. the frontend's
  "who's free for this shift" dialog when creating an `Assignment`.

`DELETE /availability/:id` — unchanged request/response shape; now returns 404 (not 403, matching
the existing `findAssignmentOrThrow` convention) when the caller isn't the owning employee or
Admin.

## Impact

`src/modules/availability/availability.service.ts`, `availability.controller.ts`,
`prisma/seed.ts` (Manager grant block only — no schema/migration change),
`src/modules/availability/availability.service.spec.ts` (update/add cases below).

## Testing Plan

- Unit (`availability.service.spec.ts`): `findAll`/`findOne` return cross-employee rows when
  `ability` allows it and nothing when it doesn't (mock ability, no more employee-lookup mocking
  needed); `remove()` denies a non-owning Employee and allows Admin/owning-Employee.
- e2e: extend `rbac-multi-role-managed-branches.e2e-spec.ts` (already covers this exact pattern
  for other subjects) with: Manager A (manages branch 1) can list branch 1's availability but
  gets an empty list for branch 2; Employee always gets only their own rows regardless of
  `branchId`; Manager cannot `POST`/`PATCH`/`DELETE` `/availability` anymore (403).

## Suggested build order

1. Seed change (#3) first — it's the authorization foundation everything else relies on.
2. Service + controller changes (#1, #2, #4) together — one PR, they're the same feature.
3. Tests (unit + e2e) land in the same PR, not after — this is exactly the kind of
   authorization-sensitive change this repo's own audits keep flagging as needing coverage before
   merge, not after.
4. (#5) only if/when actually requested — not blocking.

Once this lands, the Manager-side "weekly scheduling from registered availability" UI has
everything the backend needs to be built against: `GET /master-shifts?branchId=&from=&to=` for
the shift grid, `GET /availability?branchId=&date=` for who's free (rendered as a timeline, not a
flat grid, since `SubShift`s can overlap), and the existing `POST /assignments` (with
`availabilityId`) to actually build the roster.