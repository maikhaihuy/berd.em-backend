## Context

`enforce-manager-branch-scoping` (merged, PR #49) added a `condition: { branchId: { in: '$managedBranches' } }` grant to the seeded `Manager` role for every branch-scheduling subject that carries a direct `branchId` column, plus a relation-based condition for `employees` (which has no `branchId` at all, only reachable via `EmployeeBranch`). It deliberately left `sub-shifts` and `tasks` unconditioned in `prisma/seed.ts` because neither carries a direct `branchId` — `SubShift.masterShiftId` and `Task.masterShiftId`/`Task.subShiftId` are one/two hops away from `MasterShift.branchId`.

Investigation for this change found the gap is larger than the proposal assumed: `SubShiftsService`/`TasksService` (`src/modules/sub-shifts/sub-shift.service.ts`, `src/modules/tasks/task.service.ts`) never call `accessibleWhere()` at all — unlike `MasterShiftsService.findAll`/`findOne`, which do (`master-shift.service.ts:169-201`). Adding the seed condition alone would be inert: `CaslAbilityFactory` would build the rule, but no query would ever apply it. Both the condition *and* its enforcement in the service/controller layer are needed.

The condition-resolution mechanism itself needs no extension. `resolveValue()` in `permission-condition.helper.ts` walks the entire condition JSON generically (arrays, then every key of an object) substituting `$self`/`$managedBranches` wherever they appear — it has no allowlist of shapes, so a condition nested two relations deep, or wrapped in a top-level `OR` array, resolves exactly like the existing one-level `{ branchId: { in: '$managedBranches' } }` case. Separately, `@casl/prisma`'s `PrismaQuery` type (not the default Mongo-style `MongoQuery` `@casl/ability` normally uses) natively mirrors Prisma's own where-clause vocabulary — `in`, `some`, `is`, `AND`, `OR` are first-class operators it already interprets, both in `accessibleBy()` (query-time filtering) and in its instance-level condition matcher. So the `employees` grant's `{ employeeBranches: { some: { branchId: { in: '$managedBranches' } } } }` and the new `sub-shifts`/`tasks` conditions below are the same mechanism at a different relation depth — no code change to the CASL setup or the resolver.

## Goals / Non-Goals

**Goals:**
- Give the seeded `Manager` role's `read:sub-shifts` and `read:tasks` grants a `$managedBranches` condition that resolves correctly through the `masterShift`/`subShift` relations, closing the read-time gap identified above.
- Wire `SubShiftsService`/`TasksService` (`findAll`/`findOne`) and their controllers to actually apply `accessibleWhere()`, matching the existing `MasterShiftsService` pattern, so the new condition has an effect.
- Extend the `managed-branch-scoping` catalog metadata (`MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS`) so `GET /permissions/catalog` documents the new relation paths, keeping the documented convention in sync with the resolver as the module comment already promises.
- Add e2e coverage in `test/rbac-multi-role-managed-branches.e2e-spec.ts` mirroring the existing seeded-role assertions for the other subjects.

**Non-Goals:**
- Scoping `create`/`update`/`delete` on `sub-shifts`/`tasks` (or `master-shifts`, which has the same gap) by ability — the existing branch-scoped subjects only enforce `$managedBranches` on the read path (`findAll`/`findOne`); mutation routes are gated purely by `@RequirePermissions`, not row-level ability. This change preserves that existing scope boundary rather than expanding it; broadening mutation-level enforcement across all branch-scheduling subjects is a separate, larger change.
- Changing `Task.complete` (`POST /tasks/:id/complete`) — it's an Employee self-service action gated by an assignment check, not a Manager-branch read, and is unaffected by this change.
- Re-deriving already-deployed role grants — same caveat as the original change: an environment seeded before this change needs `pnpm db:seed` (or an equivalent backfill of the `RolePermission` rows) re-run to pick up the new conditions.

## Decisions

**Sub-shifts condition — one relation hop, always present.** `SubShift.masterShiftId` is non-nullable, so the condition is a direct analog of the `employees` case, just through a to-one relation instead of a to-many:
```json
{ "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } }
```
The explicit `is` (rather than the implicit `{ masterShift: { branchId: ... } }` shorthand) is required per the existing convention documented in `CLAUDE.md` and used nowhere yet in this codebase's seed data but already called out as necessary for `@casl/prisma`'s instance-level matcher — using it here keeps `accessibleBy`-time filtering and any future instance-level check consistent.

**Tasks condition — branch reachable through two mutually-exclusive paths.** `Task.masterShiftId` and `Task.subShiftId` are both nullable and mutually exclusive (enforced by `TasksService.validateScope`): `SHARED_MANDATORY`/`SHARED_OPTIONAL` tasks set `masterShiftId` only, `DEDICATED` tasks set `subShiftId` only. A single relation path can't express "the branch of whichever parent is set," so the condition is an `OR` of both paths:
```json
{
  "OR": [
    { "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } },
    { "subShift": { "is": { "masterShift": { "is": { "branchId": { "in": "$managedBranches" } } } } } }
  ]
}
```
Alternative considered: give `Task` a denormalized `branchId` column, or scope only one of the two task kinds. Rejected — schema changes are out of proportion to a permissions fix, and Managers need visibility into dedicated tasks too (e.g. a dedicated task on a sub-shift belonging to a branch they don't manage must stay hidden, exactly like the shared-task case).

**Wire `accessibleWhere` into `SubShiftsService`/`TasksService`.** Mirrors `MasterShiftsService` exactly: `findAll`/`findOne` take an `AppAbility` (via the controller's `@CaslAbility()` decorator) and merge `accessibleWhere(ability, 'read', SUBJECT)` into the Prisma `where` via a top-level `AND`, per the `CaslAbilityFactory` module convention already documented in `CLAUDE.md`. No change to `create`/`update`/`remove` signatures, consistent with the Non-Goals above.

**Catalog metadata.** Add to `MANAGED_BRANCHES_SCOPABLE_SUBJECT_FIELDS`:
```ts
'sub-shifts': ['masterShift.branchId'],
tasks: ['masterShift.branchId', 'subShift.masterShift.branchId'],
```
Dot-path strings are documentation only (as `employees`' `'employeeBranches.branchId'` already is) — they don't feed the resolver, which is driven entirely by the actual `RolePermission.condition` JSON.

## Risks / Trade-offs

- **[Risk]** A `Task`/`SubShift` row with neither/both parent pointers set (a data-integrity violation `validateScope` should prevent, but not a DB-level constraint) would resolve to `false`/ambiguous under the `OR` condition rather than erroring. → Mitigation: this is a pre-existing data-integrity assumption the rest of `TasksService` already relies on (e.g. `ensureEmployeeCanCompleteTask` also assumes exactly one parent is set); not newly introduced by this change.
- **[Risk]** Deployed environments won't get the new conditions until reseeded. → Mitigation: called out in Non-Goals and the proposal's Impact section, same as the original change.
- **[Trade-off]** Leaving mutation routes unscoped means a Manager can still `update`/`delete` a `sub-shift`/`task` outside their managed branches if they learn its id out-of-band (e.g. from an audit log). → Accepted: identical to the pre-existing gap on `master-shifts` and the other four branch-scoped subjects; closing it everywhere at once is a separate change.

## Migration Plan

1. Update `prisma/seed.ts` grants and re-run `pnpm db:seed` in dev to verify.
2. Ship the service/controller wiring and seed change together (the condition is inert without the wiring, so they can't usefully ship separately).
3. For already-deployed environments, re-run the seed script (idempotent upsert-by-name, per existing seed conventions) to pick up the updated `RolePermission.condition` rows — no destructive migration needed, this is a data update to existing rows, not a schema change.
4. No rollback beyond reverting the seed condition and the service/controller changes together.

## Open Questions

None — scope, mechanism, and enforcement points are all confirmed against current code.
