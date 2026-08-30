## Context

`AuthService` (`src/modules/auth/auth.service.ts`) has a private helper,
`getEmployeeWithBranches(user: AuthUser)` (lines 449-466), used by two call sites:

- `refreshToken()` (lines 234-285, backs `POST /api/auth/refresh`) — uses it to compute the
  reissued access token's `branches` list.
- `createTokenPairForUser()` (lines 292-322, backs Zalo login and dev login) — same purpose.

Today it unconditionally throws `NotFoundException('Employee record not found for user')` when
`user.employee?.id` is unset. Password login (`login()`, lines 174-198 — the only path
`staffhub-frontend` currently drives) does **not** call this helper at all; it takes
`branches`/`empId` from the already-resolved `AuthenticatedUserDto`, which tolerates a missing
employee link. So a `User` with no `Employee` record can log in via password but can never
refresh — the first refresh attempt (successful or not on the token's own merits) always 404s.
See `proposal.md` - Why for how this was found.

## Goals / Non-Goals

**Goals:**
- `refreshToken()` succeeds for a `User` with no linked `Employee`, issuing an access token with
  an empty `branches` list — matching what `login()` already does for the same user.
- Preserve the existing hard failure when `user.employee?.id` **is** set but the `Employee` row
  it points to is missing (data-integrity error, not a legitimate employee-less user) — this
  remains a bug worth surfacing loudly, not silently swallowing.
- `createTokenPairForUser()` gets the same tolerance, since it shares the helper and the same
  underlying condition can occur there too (a Zalo/dev-login `User` with no employee link).

**Non-Goals:**
- No change to `POST /api/auth/login`'s behavior — already correct.
- No change to token shapes, refresh-token rotation, or session storage.
- No change to how `Employee`-having users are handled — this only touches the employee-less
  branch of the existing logic.
- Not attempting to reconcile the separate pre-existing inconsistency where the reissued access
  token computes `branches` freshly from the DB while the reissued refresh token payload carries
  forward `refreshSession.branches` unchanged (lines 268-279) — that's a distinct question about
  whether refresh-token branch data goes stale across rotation, out of scope here.

## Decisions

**Decision: `getEmployeeWithBranches` returns `null` instead of throwing when
`user.employee?.id` is unset; callers treat `null` as "no branches."**

Alternative considered: keep the throw, and have `refreshToken()`/`createTokenPairForUser()`
each pre-check `user.employee?.id` before calling the helper. Rejected — that pushes the same
conditional into two call sites instead of one, and still leaves the helper's own contract
implicit (a caller unfamiliar with it could reintroduce the crash by calling it directly).
Returning `null` for "no employee" and keeping the `NotFoundException` for "employee id set but
row missing" makes the helper's two distinct failure/non-failure modes explicit at its own
boundary, and both call sites already do a one-line map over `employeeBranches` that's simple to
guard with `?? []`.

Concretely:
```ts
private async getEmployeeWithBranches(user: AuthUser) {
  if (!user.employee?.id) {
    return null;
  }

  const employee = await this.prisma.employee.findUnique({
    where: { id: user.employee.id },
    include: { ...employeeWithBranchesInclude },
  });

  if (!employee) {
    throw new NotFoundException('Employee record not found for user');
  }

  return employee;
}
```
And at both call sites, replace `userWithBranches.employeeBranches.map(...)` with
`userWithBranches?.employeeBranches.map(...) ?? []`.

**Decision: keep the "employee id set but row missing" case as a hard failure.**
That state means a `User.employeeId` foreign key points at a row that doesn't exist — a data
integrity problem, not a legitimate employee-less account. Silently treating it the same as "no
employee" would hide a bug that should instead surface as an error for someone to investigate.

## Risks / Trade-offs

- **[Risk] A `User` with no `Employee` link now gets a valid refreshed session with an empty
  `branches` claim, indefinitely.** → Mitigation: this is not a new capability — the same user
  already gets an equally empty-branches access token from `login()` today and can use it for as
  long as its (short) TTL lasts; this change only lets that same, already-possible state persist
  across a refresh instead of forcing a fresh login every ~2 minutes. Anything gated on `branches`
  membership already has to handle an empty list.
- **[Trade-off] `createTokenPairForUser()` (Zalo/dev login) changes behavior too, not just
  `refreshToken()`.** This is intentional (see Goals) since it shares the same helper and the
  same underlying gap, but it does mean Zalo/dev login for an employee-less user goes from "hard
  404" to "succeeds with empty branches" as a side effect of this change, not something separately
  proposed. Flagging this explicitly so it isn't a surprise at review time.

## Migration Plan

No data migration. Pure behavior fix in `auth.service.ts`. Rollback is a plain revert.
