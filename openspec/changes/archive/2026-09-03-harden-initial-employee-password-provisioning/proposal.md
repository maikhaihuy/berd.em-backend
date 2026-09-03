## Why

Found during the 2026-09-03 re-audit, grounded in current code (not the original
`make-password-login-primary` proposal — this is a follow-up to how that landed via
`auto-provision-user-on-employee-create`):

When an employee is auto-provisioned a `User` account (`src/modules/employees/employee.service.ts:90-98`),
their initial password is set to `bcrypt.hash(phoneNumber)` — i.e. **the plaintext temp password
is the employee's own phone number**, and `mustChangePassword` is set `true`. That part alone is
a documented, deliberate product decision (some initial password has to exist).

The actual bug is what happens next. `POST /auth/change-password` is one of only two routes
allowlisted via `@AllowWhilePasswordChangeRequired()` while `mustChangePassword` is still true
(`auth.controller.ts:195`, `guards/force-password-change.guard.ts`) — and it only requires the
**current** password to match (`auth.service.ts:515`), which for a not-yet-claimed account is
still the phone number.

Put together: anyone who knows an employee's phone number (coworkers, customers, delivery
partners — phone numbers are not secret in a small shop) can, before that employee ever logs in
for the first time:
1. Log in with `phoneNumber` as both username and password.
2. Immediately call `POST /auth/change-password` (allowlisted) with
   `currentPassword: phoneNumber`, `newPassword: <anything they want>`.
3. Now hold the only working password for that account — the real employee is locked out and has
   to go through an Admin-mediated recovery, if one even exists yet (see Impact).

This is a real account-takeover race, not just a UX rough edge — whoever authenticates first
"wins" the account. It's a straightforward consequence of two individually-reasonable decisions
(phone-derived temp password; allow self-service password change while flagged) combining badly.

## What Changes

- Replace the phone-number-derived initial password with a value that isn't derivable from
  public/known information — e.g. a cryptographically random one-time password or numeric code
  generated per employee at provisioning time, stored the same way (hashed) as today.
  - **Design question**: how is this delivered to the employee out-of-band? Options: shown once
    to the Admin/Manager during the create-employee flow for them to hand over verbally/on paper;
    sent via SMS; sent via Zalo message (once Zalo linking exists). This is a real product
    decision, not an implementation detail — needs a `design.md`.
- Add an expiry to the unclaimed-provisioning state: if `mustChangePassword` is still `true` and
  N days have passed since the `User` was created, the temp credential should stop working
  (reuse the `PasswordResetToken` expiry pattern, or add a comparable field) and require an
  Admin to re-issue a fresh one-time credential rather than the original one remaining valid
  indefinitely.
- Consider whether `POST /auth/change-password` should require more than just the current
  password when `mustChangePassword` is true and the account has never completed a real login —
  e.g. an out-of-band confirmation step — versus accepting that a sufficiently random/short-lived
  temp credential closes the gap on its own. Flag as a `design.md` open question rather than
  deciding unilaterally here.
- Cross-reference: `staffhub-frontend`'s `close-forced-password-change-gate-window` proposal
  (companion, drafted in the same audit pass) closes a related but distinct gap — the frontend
  not proactively surfacing `mustChangePassword` right after login. Fixing one doesn't fix the
  other; both are needed to fully close this window.

## Capabilities

### Modified Capabilities
- `employee-user-auto-provisioning`: the initial password for an auto-provisioned User is a
  random one-time credential returned once in the `POST /employees` response, instead of being
  derived from the employee's phone number.
- `forced-password-change`: the password-change-required flag gains a bounded expiry — an
  unclaimed temp credential stops working after a configurable TTL instead of remaining valid
  indefinitely.
- `password-account-recovery`: adds an Admin-facing way to re-issue a fresh one-time credential
  (mirroring the existing admin-generated reset-token flow) for an unclaimed or expired account.

## Impact

- `src/modules/employees/employee.service.ts` (initial credential generation, lines ~90-100).
- `src/modules/auth/auth.service.ts` / `force-password-change.guard.ts` (if the change-password
  requirements while flagged are tightened).
- Possibly `prisma/schema.prisma` (an expiry field on `User` or reuse of `PasswordResetToken`
  shape for the temp credential).
- Delivery mechanism for the one-time credential (SMS/Zalo/manual handoff) — genuinely
  undecided, needs product input before `openspec apply`.

**Recommend a `design.md` before `openspec apply`** — the delivery channel and the
change-password-while-flagged requirements are real open product/security questions.
