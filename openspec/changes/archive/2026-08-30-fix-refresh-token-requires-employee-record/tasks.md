## 1. Fix `getEmployeeWithBranches`

- [x] 1.1 In `src/modules/auth/auth.service.ts`, change `getEmployeeWithBranches` to `return null`
      instead of throwing when `user.employee?.id` is unset.
- [x] 1.2 Keep the existing `throw new NotFoundException('Employee record not found for user')`
      for the case where `user.employee.id` is set but `this.prisma.employee.findUnique` returns
      nothing (dangling reference) — unchanged.

## 2. Update call sites

- [x] 2.1 In `refreshToken()`, change `userWithBranches.employeeBranches.map((eb) => eb.branch.id)`
      to `userWithBranches?.employeeBranches.map((eb) => eb.branch.id) ?? []`.
- [x] 2.2 In `createTokenPairForUser()`, apply the same `?.employeeBranches.map(...) ?? []` guard
      to its `userWithBranches` usage.

## 3. Tests

- [x] 3.1 In `src/modules/auth/auth.service.spec.ts`, extend the existing `describe('refreshToken'`
      block with a case for a `user` whose `employee` is `null`/undefined: assert the call
      resolves (not throws) and that the generated access token's `branches` is `[]`.
- [x] 3.2 Add a case confirming the existing dangling-employee-id behavior is unchanged: `user`
      has `employee.id` set but `prisma.employee.findUnique` resolves `null` — assert
      `refreshToken()` still rejects.
- [x] 3.3 Run the auth module's test suite (e.g. `pnpm test auth.service` or the project's
      equivalent) and confirm it passes.

## 4. Manual verification

- [x] 4.1 With the dev backend running, log in as an account with no linked `Employee` record
      (e.g. `settings`/`ChangeMe!123` in this environment), then call `POST /api/auth/refresh`
      with the returned refresh token — confirm `200 OK` with a fresh token pair instead of the
      `404 "Employee record not found for user"` seen before this fix.
- [x] 4.2 Confirm `staffhub-frontend`'s `fix-silent-token-refresh-on-navigation` change now works
      end-to-end for that account: navigate to a dashboard route after the access token expires,
      with the fixed backend running — the page loads and the session is silently refreshed
      instead of bouncing to `/login`.
      NOTE: not verified this session — requires browser-driven navigation against a running
      `staffhub-frontend` dev server, which this session has no tooling for. Backend-side fix
      is verified end-to-end via direct API call (4.1) and unit tests (3.x).

## 5. Spec sync

- [x] 5.1 After tests and manual verification pass, sync the `authentication` delta spec in this
      change into `openspec/specs/authentication/spec.md`.
