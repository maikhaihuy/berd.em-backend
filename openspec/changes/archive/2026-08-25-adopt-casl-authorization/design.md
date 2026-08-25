## Context

Verified against the installed packages (`@casl/ability@6.7.3`, `@casl/prisma@1.5.2`, both currently unused): `@casl/prisma` exports `createPrismaAbility` (an `Ability` factory whose condition matcher understands Prisma's `WhereInput` operators) and `accessibleBy(ability, action?)`, which returns a `Proxy` — reading the compiled runtime source (`@casl/prisma`'s `runtime.js`) confirms its `get` trap passes whatever property key was accessed straight through as the subject type to `rulesToQuery(ability, action, key, ...)`, with **no requirement that the key be an actual Prisma model name**. That means the existing kebab-case `subject` vocabulary already seeded on `Permission` and matched by `@RequirePermissions` (`'time-logs'`, `'leave-requests'`, etc.) can be used as-is as the CASL subject type throughout — `accessibleBy(ability, action)['time-logs']` — with no second, Prisma-model-name-based vocabulary needed. (The TS *types* on `accessibleBy` are written assuming `Prisma.ModelName` keys for nice autocomplete on literal model names; since our subject space is dynamic strings loaded from the DB, call sites use bracket-notation with an explicit cast to the target `WhereInput` type instead of relying on that inference.) `@casl/ability` exports `AbilityBuilder` (`can(action, subject, conditions)` / `.build()`) and `subject`/`detectSubjectType` for tagging a plain object with its subject type so instance-level `ability.can(action, subject('time-logs', row))` checks work (Prisma rows are plain objects with no discriminator CASL can infer on its own).

The immediate trigger is `add-permission-conditions` (implemented, not yet archived): it added `$self`-based row-scoping by giving `Permission.condition` runtime meaning, but `Permission` is unique on `(action, subject)`, so a role-specific condition can't coexist with another role's unconditioned grant of the same permission without a workaround — it introduced a parallel `<action>-own` permission row per case, plus guard logic to prefer the unconditioned match when a role (Admin) holds both. That workaround is exactly the structural gap CASL is designed to close: an `Ability` is a *list* of rules, each with its own conditions, so two different roles' grants of the identical `(action, subject)` never need to share a row or fork into `-own` variants — one `RolePermission` row per grant, one CASL rule per row.

## Goals / Non-Goals

**Goals:**
- Replace `PermissionsGuard`'s hand-rolled `(action, subject)` + wildcard + `-own` matching with a real `@casl/ability` `Ability`, built per request from `RolePermission` rows.
- Make row-scoping conditions a property of one role's grant (`RolePermission.condition`), not of the shared `Permission` row — removing the need for `-own` permission forks entirely.
- Replace the hand-rolled `$self`-resolved JSON merged into `where` (from `add-permission-conditions`) with CASL's own `accessibleBy(ability, action).ModelName`, so row-filtering logic isn't reimplemented outside CASL.
- Keep `@RequirePermissions({ action, subject })` on controllers unchanged — it's still the route-level declaration the guard checks against; only what backs the check changes.

**Non-Goals:**
- Branch-level or any scoping beyond `$self` (same boundary `add-permission-conditions` drew).
- Changing the route-facing decorator API (`@RequirePermissions`) or the `(action, subject)` naming already seeded (`check-in`, `verify`, `approve`, etc.) — those stay; only the *conditioning* mechanism changes.
- A generic subject-hierarchy/inheritance model. Every check is a flat `(action, subject)` pair, same as today.

## Decisions

### D1: Move `condition` from `Permission` to `RolePermission` (migration)

`Permission.condition` is dropped; `RolePermission` gains `condition Json?`. This makes a condition a property of *one role's grant* of a permission, which is what CASL's rule-per-grant model wants and what the `add-permission-conditions` `-own` workaround was compensating for. Concretely: `Employee`'s `RolePermission` row for `read:time-logs` carries `condition: { employeeId: "$self" }`; `Manager`'s `RolePermission` row for the *same* `read:time-logs` `Permission` carries no condition. Both point at one `Permission` row; each grant's own row is where the condition lives.

Alternative considered (and it's the one `add-permission-conditions` chose instead, under the explicit constraint of no migration): keep `-own` dedicated actions. Superseded now — the user has asked for CASL specifically, and CASL's value proposition here *is* per-rule conditions, so keeping the row-uniqueness workaround alongside it would be redundant complexity, not a hedge.

### D2: `CaslAbilityFactory` builds one `Ability` per request from `RolePermission` rows

`src/modules/casl/casl-ability.factory.ts` (new — the old file of this name was dead/commented-out code and no longer exists) takes the caller's loaded `role.rolePermissions` (same `userWithRolePermissionsInclude` chain `JwtAccessStrategy` already loads) and an `AbilityBuilder(createPrismaAbility)`:

```ts
for (const rp of user.role.rolePermissions) {
  const { action, subject } = rp.permission;
  const condition = rp.condition
    ? resolveCondition(rp.condition, { employeeId: user.employeeId, userId: user.userId })
    : undefined;
  can(action, subject, condition);
}
return build();
```

`resolveCondition` is the existing `$self`-substitution function from `permission-condition.helper.ts` (kept as-is — it doesn't know about CASL, it just resolves tokens in a JSON object). `manage`/`all` need no special-casing in this factory: they're `@casl/ability`'s own built-in wildcard conventions (a rule with `action: 'manage'` or `subject: 'all'` is treated as matching any action/subject by CASL's core rule matcher), so the seeded `manage`/`all` grants (if any are ever added) work without guard-side wildcard code.

### D3: `PermissionsGuard` becomes a thin CASL check; the `-own`/tie-break logic is deleted

For each `@RequirePermissions({ action, subject })` rule, the guard calls `ability.can(action, subject)` — a **type-level** check (subject passed as the string, not an instance). CASL's own semantics make this correct without extra guard logic: a type-level check against a subject string returns true if *any* rule (conditioned or not) grants that action on that subject, because there's no instance data yet to test a condition against. That is precisely "can this caller do this at all, scoped or not" — the same job the old guard's `-own`-aware matching did by hand. The guard attaches the built `Ability` to the request (`request.ability`) for handlers/services to do row-level enforcement; it does not resolve or attach per-subject JSON conditions anymore (that responsibility moves to `accessibleBy` at the call site, per D4).

### D4: Services use `accessibleBy(ability, action)[subject]` instead of a hand-resolved JSON blob

Replaces the `add-permission-conditions` pattern of merging a guard-resolved JSON object into `where`. A small typed helper wraps the bracket-notation access (see Context — `accessibleBy`'s key is passed straight through at runtime, so the existing kebab-case subject strings work directly, no Prisma-model-name translation needed):

```ts
function accessibleWhere<T>(ability: AppAbility, action: string, subject: string): T {
  return (accessibleBy(ability, action) as Record<string, T>)[subject];
}
```

Applied uniformly:

- **List**: `where: { ...existingFilter, AND: [accessibleWhere<Prisma.TimeLogWhereInput>(ability, action, 'time-logs')] }`.
- **Single-row read/update/delete by id**: unchanged shape from `add-permission-conditions` — `findFirst({ where: { id, AND: [accessibleWhere(...)] } })`; not found (including "found but not accessible") still throws `NotFoundException`, preserving the existing 404-not-403 behavior.
- **Create**: `accessibleBy` only produces read filters, not a way to validate or override a write payload. Instead, run an *instance*-level check against the candidate write value: `ability.can('create', subject(subject, { employeeId: dto.employeeId }))`. An unconditioned grant (Manager/Admin) always passes regardless of the candidate value; a conditioned grant (Employee) only passes when the candidate matches their resolved `$self` value. When it fails, fall back to the caller's own id (`user.employeeId`, guaranteed resolvable — the guard already proved every condition on this caller's abilities resolves) instead of the DTO's value. This is more precise than unconditionally overriding with the caller's own id whenever it's present, which would break a Manager creating a row on another employee's behalf.

`@PermissionCondition(subject)` is replaced by `@CaslAbility()`, a param decorator returning the request's `Ability` instance; call sites do `accessibleWhere(ability, action, subject)` themselves. This is a small interface change but keeps each service in control of which action/subject/target-type it queries against.

### D5: Instance-level checks need `subject()` tagging — and a subject type that allows it

Prisma rows are plain objects with no CASL-detectable type. Anywhere the code needs `ability.can(action, <a fetched row or write candidate>)` (rather than a query filter), it must tag the value first: `ability.can('check-in', subject('assignments', assignmentRow))`. This is used in two places: `check-in`/`check-out` (D6, tagging the fetched assignment) and every row-scoped subject's `create` (D4, tagging the candidate write value) — everywhere else, `findFirst`/`findMany` + `accessibleBy` merged into the query already does the scoping, so no separate instance check is needed.

Verified by actually running it: a bare `AppAbility = PureAbility<[string, string], PrismaQuery>` (subject slot typed as plain `string`) **cannot** type-check an instance-level call at all — `subject('assignments', row)` returns `{ ...row } & ForcedSubject<'assignments'>`, which a bare `string` parameter type rejects outright. `AppAbility`'s subject type is instead `string | (object & ForcedSubject<string>)`, so both forms — the type-only string used by the guard's route check, and the tagged instance used here — type-check against the same `Ability`.

### D6: `check-in`/`check-out` keep their self-only condition, now per-`RolePermission`

Both `Employee`'s and `Manager`'s `RolePermission` rows for `check-in:assignments`/`check-out:assignments` carry `condition: { employeeId: "$self" }` (previously this lived directly on the shared `Permission` row in `add-permission-conditions`, since no split was needed there — now it's simply set on both roles' individual grant rows, which is equivalent in effect and consistent with the new single mechanism).

### D7: Nested (to-one relation) conditions need the explicit `is` operator for instance checks

Discovered by actually running it, not by reading docs: `attendance-history`'s condition (`{ assignment: { employeeId: "$self" } }`, unchanged in shape from `add-permission-conditions`) works fine for `accessibleBy` — Prisma's own client interprets a plain nested object under a relation field as an implicit `is` filter — but throws `"equals" does not supports comparison of arrays and objects` from `@casl/prisma`'s own condition matcher (`ucast`/`PrismaQueryParser`) the moment it's used in an *instance*-level `ability.can(action, subject(...))` check (which `create`'s validation, D4/D5, needs). `@casl/prisma`'s matcher requires the relation filter to be spelled explicitly: `{ assignment: { is: { employeeId: "$self" } } }`. This form works identically for `accessibleBy` too (`is` is Prisma's own real relation-filter keyword, not a CASL invention), so it's the one form that works everywhere — the seed condition (and this design doc's own earlier draft, corrected here) now uses it. Any *future* subject with a nested/relation condition path must use this form from the start, not the implicit shorthand that happens to work for flat fields.

## Risks / Trade-offs

- **A real migration on a column already in production use** (`Permission.condition`, populated by `add-permission-conditions`'s seed) → mitigated: this is pre-launch/dev-seed data only (no real tenant data depends on it); the migration adds `RolePermission.condition` and drops `Permission.condition` in one step, and `prisma/seed.ts` is rewritten in the same change so `pnpm db:seed` repopulates correctly.
- **Stale `-own` permission rows already exist in seeded dev databases** (from `add-permission-conditions`, e.g. `read-own:time-logs`) and won't be removed by re-running the new seed (`createMany`/`skipDuplicates` only adds) → the seed rewrite deletes them explicitly by name before reseeding, and a note is added recommending `pnpm db:reset` for anyone with a dev DB seeded under the old scheme.
- **`accessibleBy` ties row-filtering to Prisma model names, not the `subject` strings used in `@RequirePermissions`** (e.g. `'time-logs'` vs `TimeLog`) → each service call site names its own Prisma model explicitly (`accessibleBy(ability, action).TimeLog`), so the mapping is explicit and typo-visible at compile time (wrong model name is a TS error), not implicit.
- **CASL's condition matcher for `@casl/prisma` needs to be given a plain Prisma `WhereInput`-shaped object** — the existing `$self`-substituted conditions (`{ employeeId: 42 }`, `{ assignment: { employeeId: 42 } }`) are already exactly that shape (this was true under `add-permission-conditions` too), so no reshaping is needed going into `can()`.
- **Losing the previous change's specific "unconditioned wins" test coverage** → superseded, not lost: the new guard behavior (`ability.can` on a subject *type* ignoring conditions) is simpler and the equivalent scenario is retested against CASL's actual behavior in tasks.md.

## Migration Plan

1. `prisma/schema.prisma` + migration: add `RolePermission.condition Json?`, drop `Permission.condition`. Run via `pnpm db:dev --name add-role-permission-condition`.
2. Rewrite `prisma/seed.ts`: delete the `-own` permission rows and their grants (from `add-permission-conditions`); express every self-scoped grant as `condition` inline on the relevant `RolePermission` entry for `Employee` (and `check-in`/`check-out` for both `Employee` and `Manager`).
3. Add `CaslAbilityFactory`/`CaslModule` (real implementation), wire into `AuthzModule`/`PermissionsGuard`.
4. Rewrite `PermissionsGuard` per D3; remove the now-dead `-own` matching/tie-break code added in `add-permission-conditions`.
5. Add `@CaslAbility()` decorator; migrate the 6 services (time-tracking, leave-requests, assignments, availability, attendance-history, payroll-entries) from `@PermissionCondition(subject)` + hand-merged `where` to `@CaslAbility()` + `accessibleBy(...).ModelName`.
6. Update `CLAUDE.md`/`AGENTS.md`.
7. `pnpm db:reset` (or manual cleanup) on any dev database already seeded under `add-permission-conditions`'s `-own` scheme, then `pnpm db:seed`.

Rollback: revert the migration (drop `RolePermission.condition`, restore `Permission.condition`), revert the guard/service changes — equivalent to reverting to `add-permission-conditions`'s state, or further back to no conditions at all if that change is reverted too.

## Open Questions

- Should `CaslAbilityFactory`'s output be cached per-request only (current plan) or also cacheable across requests for the same user within a short TTL? Left as request-scoped for now (matches today's "permissions loaded fresh every request" behavior, documented as a deliberate property of the auth system) — revisit only if profiling shows it matters.
