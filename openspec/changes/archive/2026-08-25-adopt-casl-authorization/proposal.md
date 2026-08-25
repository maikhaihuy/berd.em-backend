## Why

`@casl/ability` and `@casl/prisma` have sat in `package.json` unused since an earlier, abandoned attempt (`src/modules/casl/casl-ability.factory.ts`, which no longer even exists in the tree). Authorization today is a hand-rolled `(action, subject)` matcher in `PermissionsGuard`. The most recent evolution of that matcher (`add-permission-conditions`, implemented but not yet archived) hit CASL's exact home turf — per-request row-scoping conditions (`$self`) — and had to work around a real structural limit to get there: `Permission` is unique on `(action, subject)`, so a role-specific condition can't live on that shared row without also scoping every other role holding the same permission. The workaround was a parallel `<action>-own` permission row per case that needed it, plus custom guard logic to prefer the unconditioned match. It works, but it's exactly the kind of rule-with-conditions problem CASL is built to express directly — one `Ability` rule per grant, conditions included, no row-uniqueness constraint to dodge.

This change replaces the hand-rolled matcher with a real CASL `Ability` built per request from the same `Role -> RolePermission -> Permission` data, and removes the `-own` workaround it superseded.

## What Changes

- Add `condition` to `RolePermission` (new column, migration) so a condition is a property of one role's grant, not of the shared `Permission` row — the structural fix that makes per-role conditions natural instead of needing `<action>-own` permission forks. `Permission.condition` is dropped once `RolePermission.condition` is in place (single source of truth).
- Add `src/modules/casl/casl-ability.factory.ts` (real this time) that builds an `Ability` instance from a user's `RolePermission` rows via `@casl/ability`'s `AbilityBuilder`, substituting `$self` in each grant's `condition` for the caller's `employeeId`/`userId` (reusing the resolution rules — flat and relation-nested — from `permission-condition.helper.ts`).
- **BREAKING** (internal): `PermissionsGuard` no longer does its own `(action, subject)` + wildcard + `-own` matching. It builds the caller's `Ability` via `CaslAbilityFactory` and calls `ability.can(action, subject)`; `manage`/`all` wildcards are expressed as CASL's native `manage`/`all` conventions instead of guard-side special-casing.
- Row-scoped services (time-logs, leave-requests, assignments, availability, attendance-history, payroll-entries) stop reading a hand-resolved JSON condition off the request and instead get a Prisma `where` clause via `@casl/prisma`'s `accessibleBy(ability, action)[subject]`, replacing `@PermissionCondition(subject)` with an equivalent CASL-backed decorator (or the same decorator name, re-implemented).
- Remove the `-own` dedicated-permission convention introduced by `add-permission-conditions`: `read-own`, `create-own`, `cancel-own`, `update-own`, `delete-own` permission rows and their seed grants are deleted; the plain action (`read`, `create`, etc.) is granted with a per-`RolePermission` condition instead.
- `prisma/seed.ts` is restructured so role grants can carry a condition inline (e.g. `{ subject: 'time-logs', actions: ['read'], condition: { employeeId: '$self' } }` for `Employee`) rather than resolving to a separately-seeded `-own` permission id.
- `check-in`/`check-out` on `assignments` keep their self-only condition, now expressed the same way as every other conditioned grant (per-`RolePermission`, not a special-cased shared row).
- Update `CLAUDE.md`/`AGENTS.md` — the "Authorization is NOT CASL" section becomes wrong and needs rewriting to describe the real CASL-based system.
- Out of scope: branch-level or any scoping beyond `$self` (same boundary as `add-permission-conditions`); changing what `@RequirePermissions({ action, subject })` looks like on controllers (it stays as the route-level declaration CASL is checked against).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `authorization`: the enforcement engine changes from a hand-rolled matcher to a CASL `Ability` built per request; `Permission`/`RolePermission`'s condition-bearing column moves from `Permission` to `RolePermission`; the `-own` dedicated-action convention is removed and its role is taken over by native per-grant CASL conditions.

## Impact

- `prisma/schema.prisma` — migration: add `RolePermission.condition Json?`, drop `Permission.condition`.
- `prisma/seed.ts` — remove the `-own` permission rows and their role grants (added in `add-permission-conditions`); attach `condition` per role grant instead.
- `src/modules/casl/casl-ability.factory.ts`, `casl.module.ts` — new, real implementation (replacing the deleted dead file of the same name).
- `src/common/guards/permissions.guard.ts` — rewritten to delegate to `CaslAbilityFactory`; the `-own`-matching and unconditioned-wins tie-break logic added in `add-permission-conditions` is removed (CASL's rule ordering/`can`/`cannot` replaces it).
- `src/common/guards/permission-condition.helper.ts` — `$self` resolution logic is reused (moved into or called from the ability factory); the guard no longer calls it directly to attach a raw JSON condition to the request.
- `src/modules/auth/decorators/permission-condition.decorator.ts` and its 6 call sites (time-tracking, leave-requests, assignments, availability, attendance-history, payroll-entries controllers/services) — re-implemented against `accessibleBy(ability, action)[subject]` instead of a hand-resolved JSON object.
- `package.json` — `@casl/ability`/`@casl/prisma` become real, used dependencies.
- `CLAUDE.md`, `AGENTS.md` — authorization section rewritten.
- `openspec/specs/authorization/spec.md` — requirements updated; this change's delta supersedes the equivalent delta from `add-permission-conditions` (not yet archived) for the parts CASL takes over.
