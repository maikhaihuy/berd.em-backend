## 1. Schema migration

- [x] 1.1 Add `condition Json?` to `RolePermission` in `prisma/schema.prisma`.
- [x] 1.2 Remove `condition Json?` from `Permission` in
      `prisma/schema.prisma`.
- [x] 1.3 Run `pnpm db:dev --name add-role-permission-condition` to generate
      and apply the migration. (`prisma migrate dev` refused to run in this
      non-interactive shell — generated the SQL via `prisma migrate diff`,
      hand-placed it in a timestamped `prisma/migrations/` folder, applied
      with `prisma migrate deploy`.)
- [x] 1.4 Regenerate the Prisma client and confirm `Prisma.RolePermission*`
      types include `condition` and `Prisma.Permission*` types no longer do.
      Confirmed via `tsc --noEmit`: `rp.permission.condition` now fails to
      compile in `jwt-access.strategy.ts` (fixed in task 5, see below), which
      proves the type moved off `Permission`.

## 2. Seed rewrite

- [x] 2.1 Remove the `read-own`/`create-own`/`cancel-own`/`update-own`/
      `delete-own` permission entries from `permissionsSeed` in
      `prisma/seed.ts` (added by `add-permission-conditions`).
- [x] 2.2 Remove `condition` from the `check-in`/`check-out` permission
      entries (it moves to the per-role grant, task 2.4).
- [x] 2.3 Restructure role-permission grant resolution so a `Grant` can carry
      an optional `condition` alongside `subject`/`actions`, and
      `resolveIds`/the role-seeding loop persists it onto the created
      `RolePermission` row (not the `Permission` row). (Renamed
      `resolveIds`/`Grant` to `resolveGrants`/`ResolvedGrant` since it now
      returns `{ permissionId, condition }` pairs, not bare ids.)
- [x] 2.4 Re-express `Employee`'s row-scoped grants (`read`/`create` on
      time-logs; `read`/`create`/`cancel` on leave-requests; `read` on
      assignments; `read`/`create`/`update`/`delete` on availability;
      `read`/`create` on attendance-history; `read` on payroll-entries) as
      the plain action with `condition: { employeeId: "$self" }` (or
      `{ absenceEmployeeId: "$self" }` / `{ assignment: { employeeId: "$self" } }`
      per subject, per design.md D1) on `Employee`'s `RolePermission` row.
- [x] 2.5 Add `condition: { employeeId: "$self" }` to **both** `Employee`'s
      and `Manager`'s `check-in`/`check-out` grants on `assignments`.
- [x] 2.6 On the dev database already seeded under `add-permission-conditions`,
      did a **targeted** cleanup instead of `pnpm db:reset` (which drops the
      whole DB) — deleted the 13 stale `-own`-suffixed `Permission` rows
      directly (`onDelete: Cascade` on `RolePermission.permission` took their
      `RolePermission` links with them), then reseeded. Same end state, less
      destructive.
- [x] 2.7 Ran `pnpm db:seed` twice (idempotent, no errors/duplicates) and
      spot-checked via a throwaway script: 0 stale `-own` rows remain;
      `Employee`'s `RolePermission.condition` is set on exactly the expected
      grants (plain action names, no `-own`); `Manager`'s/`Admin`'s grants of
      the same `Permission` rows carry no condition, except `check-in`/
      `check-out` which both roles now carry `{ employeeId: "$self" }` on.

## 3. CASL ability factory

- [x] 3.1 Create `src/modules/casl/casl-ability.factory.ts`: builds a
      `createPrismaAbility`-based `Ability` from a user's `permissions` list
      (`{ action, subject, condition }` entries), resolving `$self` in each
      `condition` via the existing `resolveCondition` from
      `permission-condition.helper.ts` before calling
      `can(action, subject, resolvedCondition)`. Verified at runtime (not
      just types) with a throwaway script: type-level `can()`, `accessibleBy`
      filtering (flat + nested), `manage`/`all`, and instance-level
      `subject()` checks all behave exactly as design.md describes. Found
      and fixed a real typing gap along the way — a bare `[string, string]`
      Abilities tuple can't support instance-level `can(action, subject(...))`
      checks; `AppAbility`'s subject slot is `string | (object &
      ForcedSubject<string>)` instead. Also corrected design.md/specs/tasks:
      `accessibleBy(ability, action)` is a plain Proxy keyed by whatever
      string you access — it needs our existing kebab-case subject strings
      (`['time-logs']`), not Prisma model names (`.TimeLog`) as originally
      (incorrectly) assumed.
- [x] 3.2 Create `src/modules/casl/casl.module.ts` exporting the factory as
      an injectable provider; import it wherever `PermissionsGuard` needs it
      (likely `AuthzModule`).
- [x] 3.3 Unit tests for `CaslAbilityFactory`: unconditioned grant produces
      an unconditioned rule; conditioned grant resolves `$self` into the
      rule's conditions; unresolvable `$self` throws `ForbiddenException`
      (reuses `permission-condition.helper.spec.ts`'s existing cases against
      the new call site); `manage`/`all` grants are treated as CASL's native
      wildcard (no bespoke guard code needed — verify via `ability.can`).

## 4. Guard rewrite

- [x] 4.1 Rewrite `src/common/guards/permissions.guard.ts` per design.md D3:
      build the `Ability` via `CaslAbilityFactory`, then for each
      `@RequirePermissions` rule call `ability.can(action, subject)` as a
      subject-*type* check (AND semantics preserved across multiple rules).
- [x] 4.2 Remove the `-own`-suffix matching and "unconditioned wins"
      tie-break logic added in `add-permission-conditions` — superseded by
      CASL's own type-vs-instance check semantics.
- [x] 4.3 Attach the built `Ability` to the request (e.g.
      `request.ability`) for handlers/services; remove the old
      `request.permissionConditions` attachment.
- [x] 4.4 Update `src/common/guards/permissions.guard.spec.ts`: replace the
      `-own`/tie-break/condition-attachment tests with CASL-backed
      equivalents (route-level `can` check passes regardless of condition;
      `request.ability` is attached; deny-by-default and wildcard scenarios
      still pass unchanged). All 14 tests pass, including two using the real
      `CaslAbilityFactory` (no dependencies of its own, so no mock needed)
      to verify `accessibleBy` output directly off `request.ability`.

## 5. `@CaslAbility()` decorator

- [x] 5.1 Add `src/modules/auth/decorators/casl-ability.decorator.ts`
      (`@CaslAbility()`) reading `request.ability`, replacing
      `permission-condition.decorator.ts` (`@PermissionCondition`). Also
      added `src/modules/casl/accessible-where.ts` (`accessibleWhere`
      helper) since every service needed the same bracket-notation
      `accessibleBy(ability, action)[subject]` cast (design.md D4).
- [x] 5.2 Removed `src/modules/auth/decorators/permission-condition.decorator.ts`
      after confirming (via grep) every call site had migrated — zero
      remaining references.

## 6. Migrate row-scoped services to `accessibleBy`

- [x] 6.1 Time-logs (`time-tracking.controller.ts`/`.service.ts`): replace
      `@PermissionCondition('time-logs')` + hand-merged `where` with
      `@CaslAbility()` + `accessibleWhere(ability, action, 'time-logs')`
      merged into `findMany`/`findFirst` `where` via `AND: [...]`. Create
      does an instance-level `ability.can('create', subject('time-logs', {
      employeeId }))` check and falls back to the caller's own employeeId
      only when that fails — a plain "always override with caller's own"
      would have broken Manager-creates-on-behalf-of-another-employee, since
      Manager's grant is unconditioned and must stay so.
- [x] 6.2 Leave-requests: same pattern —
      `accessibleWhere(ability, action, 'leave-requests')`; create does the
      same instance-level check against `absenceEmployeeId`. Found and fixed
      a real, previously-latent bug while writing this: `resolveSelfToken`
      in `permission-condition.helper.ts` only recognized the literal keys
      `employeeId`/`userId`, never compound names like
      `absenceEmployeeId` — meaning `condition: { absenceEmployeeId: "$self"
      }` (seeded since the very first change) would have thrown
      `ForbiddenException` on every real request. Neither the earlier
      guard/seed tests nor this change's until now actually exercised that
      code path end-to-end. Fixed by matching on `key.endsWith('EmployeeId'
      | 'UserId')` too, with test coverage added.
- [x] 6.3 Assignments: same pattern for `read` —
      `accessibleWhere(ability, action, 'assignments')`; `check-in`/
      `check-out` verify the target assignment belongs to the caller via
      `ability.can(action, subject('assignments', assignment))` (instance
      check, per design.md D5) inside `findAssignmentOrThrow`, 404ing if it
      fails. `findAll`/`findOne` keep `ability` optional since `update()`
      calls `findOne(id)` internally with no ability for its own unrelated,
      unscoped existence check. Also fixed two type-import issues surfaced
      by `tsc` here: `import { AppAbility }` → `import type` in the three
      migrated controllers (TS1272: decorator metadata + isolatedModules
      requires type-only imports for types used only in decorated method
      parameter positions), and the `accessibleWhere` helper's cast (`as
      Record<string, T>` directly isn't safe per TS given `accessibleBy`'s
      real return type; routed through `unknown` first).
- [x] 6.4 Availability: same pattern for `read` (`findAll`/`findOne`) —
      `accessibleWhere(ability, action, 'availability')`; `create`/`update`/
      `delete` keep their existing, stricter `getCurrentUserEmployee`-based
      self-scoping untouched (per the `add-permission-conditions` finding
      that they already fully self-scope regardless of role).
- [x] 6.5 Attendance-history: same pattern —
      `accessibleWhere(ability, action, 'attendance-history')`. The
      `employeeId`-overwrite bug fixed in `add-permission-conditions` is now
      structurally impossible rather than order-dependent: the accessibility
      filter lives in its own top-level `AND: [...]` array, so `where.assignment
      = { employeeId }` from the query filter can never collide with it —
      Prisma implicitly ANDs every top-level key together with the explicit
      array (verified: mismatched filter + condition now correctly yields
      zero rows instead of one silently overriding the other). Also found and
      fixed a second real bug here, verified by actually running it: CASL's
      own condition matcher (not Prisma's) throws `"equals" does not
      supports comparison of arrays and objects` on a *nested* condition
      like `{ assignment: { employeeId: "$self" } }` when used in an
      instance-level check (needed for `create`'s validation) — Prisma
      tolerates the implicit-object shorthand for relation filters,
      `@casl/prisma`'s matcher does not. Fixed by seeding the explicit `is`
      form instead: `{ assignment: { is: { employeeId: "$self" } } }`, which
      works identically for both `accessibleBy` and instance checks (see
      design.md D7). Re-seeded the dev DB with the corrected shape.
- [x] 6.6 Payroll-entries: same pattern —
      `accessibleWhere(ability, action, 'payroll-entries')`.
- [x] 6.7 Confirmed `permission-condition.helper.ts` has exactly one runtime
      caller now (`CaslAbilityFactory`, per task 3.1) — no service imports it
      directly anymore; the helper itself stays as-is (it's CASL-agnostic
      JSON `$self` resolution, reused rather than duplicated).

## 7. Tests

- [x] 7.1 Updated the 5 service unit test files added in
      `add-permission-conditions` (plus `assignment.service.spec.ts`,
      touched too since check-in/check-out changed) to build a real
      `Ability` via `CaslAbilityFactory` (no mocking needed — it has no
      dependencies) instead of passing a raw `condition` object. Same
      behaviors asserted: unscoped caller sees all rows, self-scoped caller
      sees only own rows, self-scoped detail read on another employee's row
      404s, self-scoped create ignores a spoofed owner id (or falls back to
      it correctly via the new instance-check pattern) — plus new coverage
      an unscoped Manager creating/checking-out on another employee's
      behalf is unaffected, which the naive "always override" approach from
      the design's first draft would have broken.
- [x] 7.2 `test/time-tracking-row-scoping.e2e-spec.ts` needed no changes —
      passes unmodified against the CASL-based guard/service. Full e2e
      suite: 21/21 passing when run serially (`--runInBand`); a parallel
      run showed 16 failures that were pure worker/DB-connection contention
      (5s `beforeAll` timeouts in the *other* untouched e2e specs, not
      failures in the assertions themselves) — not a regression.

## 8. Docs

- [x] 8.1 Rewrote the "Authorization is NOT CASL" section in `CLAUDE.md` and
      `AGENTS.md` (now "Authorization runs on CASL" / "Authorization — real
      CASL..."): `RolePermission` carries the condition, `CaslAbilityFactory`
      builds an `Ability` per request, `PermissionsGuard` checks
      `ability.can(action, subject)`, services use `accessibleWhere(ability,
      action, subject)`, the `is`-operator requirement for nested
      conditions, and a new AGENTS.md troubleshooting-table row for it.
      Also fixed the stale intro-paragraph and file-tree "DEAD CODE" lines
      in both docs, and the `src/modules/casl/` tree comment.

## 9. Supersession cleanup

- [x] 9.1 Confirmed with the user and removed
      `openspec/changes/add-permission-conditions/` — it was implemented but
      never archived, and everything it introduced (the `-own` convention,
      `permission-condition.decorator.ts`, the guard's tie-break logic) is
      fully superseded by this change.
