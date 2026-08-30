# staffhub-backend — OpenSpec change proposal

## `auto-provision-user-on-employee-create` — priority: high

### Why
Today, creating an `Employee` (`EmployeesService.create`) and creating a `User`
(`UsersService.create`) are two fully independent flows. `Employee.userId` is nullable and
nothing in the codebase ever sets it — there is no linking endpoint at all. An Admin who wants a
new employee to be able to log in currently has to separately create a `User` with a manually
chosen password via the Users screen, then has no way to attach it to the `Employee` record
through the API.

Confirmed on `develop`:
- `prisma/schema.prisma:256-286` (`Employee`) — `userId Int? @unique`, comment
  `// cho phép null lúc đầu, sau đó sẽ gán khi nhân viên được tạo`, but no code path ever does
  that assignment.
- `EmployeesService.create` — creates only the `Employee` row; no `User` involved.
- `UsersService.create` / `CreateUserDto` — already supports an optional `password` field
  (hashed via `PasswordService`), but nothing calls it from the employee flow.
- `User` model has no `mustChangePassword` field yet — needs a migration.
- No authenticated "change my own password" endpoint exists yet (`auth.controller.ts` has
  `login`, `refresh`, `logout`, `logout-device`, `logout-all`, `forgot-password`,
  `reset-password`, `link/zalo` — nothing for a logged-in user to change their own password).
  This is required to make `mustChangePassword` actually resolvable, not just a flag that's
  never cleared.
- Seeded role `Employee` exists (`prisma/seed.ts`, `name: 'Employee'`) — this is the role to
  default-assign.

### What Changes

**1. Schema migration**
- Add `mustChangePassword Boolean @default(false)` to `User`.
- (Per product decision: no separate temp-password-expiry field — `mustChangePassword` alone is
  the gate. Not adding `passwordSetAt`/`tempPasswordExpiresAt` since nothing in scope needs them.)

**2. `EmployeesService.create` — wrap Employee + User creation in one transaction**
- Before creating the `Employee`, check whether a `User` with `phoneNumber = employeeData.phoneNumber`
  already exists.
  - If **not** exists: create it with `phoneNumber` = employee's phone number,
    `fullName` = employee's full name, `password` = `bcrypt.hash(phoneNumber)` (via the existing
    `PasswordService`), `status = ACTIVE`, `mustChangePassword = true`, and assign the seeded
    `Employee` role (`roleIds: [employeeRoleId]` — resolve the role id by `name: 'Employee'` at
    startup/module init rather than hardcoding a numeric id, so seed-order changes don't break
    this).
  - If a `User` with that phone number **already exists**: **do not** silently reuse or
    overwrite it — reject with a clear `FieldValidationException('phoneNumber', ...)` telling
    the Admin a user account with that phone already exists, and let them resolve it manually
    (e.g. that phone belongs to an existing Manager/Admin, or a previously-created orphaned
    User). Flagging this explicitly as a design decision: silently attaching an
    Employee to a pre-existing User with roles/permissions the Admin didn't intend could grant
    unexpected access, so failing loud is safer than guessing.
- Set `Employee.userId` to the new (or, in the reuse-rejected case, N/A) `User.id` at creation
  time, inside the same transaction — so `Employee` and its `User` are created atomically; if
  either half fails, both roll back.
- `CreateEmployeeDto`/the create-employee flow does **not** take a `password` input — it's always
  derived from `phoneNumber`, per this requirement. (`UsersService.create`'s existing optional
  `password` field is untouched and still used for the standalone "create a User directly," e.g.
  for Admins/Managers who aren't Employees.)

**3. Enforce `mustChangePassword` — backend guard**
- Add `mustChangePassword` to `AuthenticatedUserDto`, populated live from the DB in
  `JwtAccessStrategy.validate()` (already queries the user fresh per request — no stale-JWT-claim
  problem to worry about).
- Add a global-ish guard (e.g. `ForcePasswordChangeGuard`, applied after `JwtAuthGuard`) that, when
  `req.user.mustChangePassword === true`, allows only an explicit allowlist of routes
  (`POST /auth/change-password`, `POST /auth/logout`, `POST /auth/logout-device`,
  `POST /auth/logout-all`, `POST /auth/refresh`) and rejects everything else with `403` and a
  distinct error code/message (e.g. `PASSWORD_CHANGE_REQUIRED`) the frontend can key off of.

**4. New endpoint: `POST /auth/change-password`** (authenticated, `JwtAuthGuard`)
- Body: `{ currentPassword: string, newPassword: string }`. Requires `currentPassword` to match
  even when `mustChangePassword` is true (defense in depth — a valid access token alone
  shouldn't be enough to change the password without proving knowledge of the current/temp one).
- On success: hash and persist `newPassword`, set `mustChangePassword = false`. Reuse
  `PasswordService` for hashing/comparison; do not reuse the token-based `PasswordResetToken`
  flow here — that's for logged-out "forgot password," this is for a logged-in, known user.

### Capabilities
**New:**
- `employee-user-auto-provisioning` — creating an Employee always provisions a matching User
  (default password = phone number, `Employee` role, `mustChangePassword = true`) in the same
  transaction, or fails loudly if a User with that phone already exists.
- `forced-password-change` — a User flagged `mustChangePassword` is restricted to a small set of
  auth-only endpoints until they successfully call `POST /auth/change-password`.

### Impact
`prisma/schema.prisma` (+ migration), `src/modules/employees/employee.service.ts`,
`src/modules/employees/dto/create-employee.dto.ts` (no `password` field — explicitly not
adding one), `src/modules/auth/strategies/jwt-access.strategy.ts`,
`src/modules/auth/dto/authenticated-user.dto.ts`, new `src/modules/auth/guards/force-password-change.guard.ts`,
`src/modules/auth/auth.controller.ts` (+route), `src/modules/auth/auth.service.ts` (+method),
`prisma/seed.ts` (resolve `Employee` role id by name, don't hardcode).

### Open questions worth a short `design.md` before `openspec apply`
- **Existing employees with `userId = null`**: this proposal only auto-provisions for *newly
  created* Employees going forward. Whether to backfill existing Employees with no linked User is
  a separate decision (a one-off migration/admin action) — not included here unless bro wants it
  folded in.
- **Phone-number collision behavior**: confirmed above as "reject and let Admin resolve
  manually" — flagging again here since it's the one place this proposal makes an assumption
  rather than following an existing pattern.