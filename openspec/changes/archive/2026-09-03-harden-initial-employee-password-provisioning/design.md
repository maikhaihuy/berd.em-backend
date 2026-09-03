## Context

`EmployeesService.create` (`src/modules/employees/employee.service.ts:90-105`) auto-provisions a
`User` for a new `Employee` whenever no `User` exists for that phone number. The initial password
is currently `bcrypt.hash(phoneNumber)` — i.e. the plaintext temp credential *is* the employee's
own phone number, which is not secret in a small shop (coworkers, customers, delivery partners all
know it). Combined with `POST /auth/change-password` being reachable while `mustChangePassword` is
still `true` (`AllowWhilePasswordChangeRequired()`, `auth.controller.ts:195`) and only checking the
*current* password (`auth.service.ts:515`), anyone who knows the phone number can log in and claim
the account — a first-authenticator-wins race, not a UX rough edge.

`POST /employees` is already gated by `@RequirePermissions({ action: 'create', subject: 'employees' })`
(`employee.controller.ts:30`) — only Admins/Managers with that grant can call it. The `User` model
has no expiry field for the unclaimed-provisioning state (`mustChangePassword` is a plain boolean,
`prisma/schema.prisma:92`); the `PasswordResetToken` model (`prisma/schema.prisma:220-229`) shows
the existing expiry pattern used elsewhere in this codebase.

Login (`POST /auth/login`) and `forgot-password`/`reset-password` are all already throttled to
5 attempts/minute per the global `ThrottlerModule` (`auth.controller.ts:90,162,179`).

## Goals / Non-Goals

**Goals:**
- The initial credential for an auto-provisioned employee account must not be derivable from
  information the employee's coworkers/customers/delivery partners already know.
- The unclaimed-provisioning window must be time-bounded — an unclaimed temp credential
  eventually stops working, rather than remaining a permanently valid attack surface.
- An Admin must have a way to re-issue a fresh one-time credential when the original expires or
  is lost before handoff, without resorting to raw DB edits.
- Keep the blast radius inside `employees`/`users`/`auth` — no new external delivery integration
  (SMS/Zalo messaging) in this change.

**Non-Goals:**
- Building an SMS or Zalo-message delivery channel for the credential. The credential is
  displayed once in the `POST /employees` (and re-issue) API response, for the calling
  Admin/Manager to hand over verbally or on paper — the same trust boundary that already gates
  employee creation. Automated out-of-band delivery is a real future improvement but is separable
  and not blocking.
- Changing anything about `forgot-password`/`reset-password` (the already-claimed-account
  recovery path) — this change is scoped to *initial* provisioning only.
- Adding password complexity rules for user-chosen passwords (`changePassword`'s `newPassword`) —
  out of scope; only the system-generated initial credential's format is addressed here.

## Decisions

**1. Random one-time credential, not a phone-derived one.**
Generate an 8-character code from a 32-character unambiguous alphabet (uppercase letters and
digits, excluding `0/O/1/I/L` to avoid transcription errors when an Admin reads it aloud or writes
it down), via `crypto.randomBytes` — not `Math.random()`. 8 chars over a 32-symbol alphabet is
2^40 (~1.1 trillion) possibilities, which is unguessable against the existing 5-attempts/minute
login throttle. Hashed with the existing `PasswordService.hash` (bcrypt) before storage, same as
today — only the storage *input* changes, not the storage mechanism.
- *Alternative considered*: numeric-only PIN (e.g. 6 digits). Easier to read aloud but only 10^6
  possibilities — still throttle-resistant here, but the alphanumeric option costs nothing extra
  and leaves more headroom if throttling parameters ever loosen. Rejected in favor of alphanumeric.

**2. Delivery: return the plaintext credential once, in the API response, to the calling Admin.**
`POST /employees`'s response gains a `temporaryPassword` (or similarly named) field populated only
on the response to *that specific create call* — never persisted in plaintext, never returned by
any subsequent `GET`. This mirrors the existing `POST /users/:id/password-reset-token` pattern
(`user.controller.ts:106-121`), which already returns a raw secret in an admin-only response for
manual relay. Because `POST /employees` is already `create:employees`-gated, this doesn't widen
who can see the secret beyond who could already create the account.
- *Alternative considered*: SMS/Zalo delivery. Deferred — see Non-Goals. Flagged as a genuine
  future improvement, not silently dropped.

**3. Time-bound the unclaimed state with `mustChangePasswordExpiresAt`.**
Add `mustChangePasswordExpiresAt DateTime?` to `User`. Set it to `now() + INITIAL_PASSWORD_TTL_DAYS`
(new env var, default 7) whenever a one-time credential is issued (initial provisioning, and
re-issuance — see Decision 4). `AuthService`'s credential validation (wherever `LocalAuthGuard`
currently checks the password — `local.strategy.ts` / `auth.service.ts`) additionally rejects the
login with a distinct, actionable error (not the generic "invalid credentials") when
`mustChangePassword` is `true` and `mustChangePasswordExpiresAt` is in the past, directing the
caller to ask an Admin to re-issue. The field is cleared (`null`) whenever `mustChangePassword`
flips back to `false` via a successful `changePassword` call, so a normal user's real password is
never subject to this check.
- *Alternative considered*: reuse `PasswordResetToken` (a separate row + hashed random token,
  compared instead of the `User.password` field) instead of a boolean+expiry on `User`. Rejected:
  that model represents a *self-service reset flow* (request → email/SMS token → redeem), which is
  a different shape than "the password itself is a short-lived secret" — reusing it would mean
  login no longer goes through the normal password-check path at all, a much larger blast radius
  for this change. A plain expiry column composes with the existing `mustChangePassword` check
  with minimal new surface.

**4. Admin re-issue endpoint instead of extending `forgot-password`.**
Add `POST /users/:id/reissue-initial-password` (admin-gated, `create`/`update` on `users` —
match existing convention), audit-logged like other `users` mutations. It generates a fresh
one-time credential the same way as initial provisioning, overwrites `User.password` (hashed),
resets `mustChangePassword: true` and `mustChangePasswordExpiresAt`, and returns the new plaintext
credential once in the response — same shape as `POST /employees`.
- *Alternative considered*: route re-issuance through the existing `forgot-password` /
  `reset-password` token flow. Rejected: that flow assumes the account holder can receive a
  token via an out-of-band channel the system already has (which doesn't exist yet for a
  never-logged-in employee — that's the whole reason the temp-credential model exists). It's also
  a materially different UX (employee-initiated token redemption vs. Admin handing over a new
  code), and would leave the *original* problem (Admin has no way to generate a fresh handoff
  secret) unsolved.

**5. Leave `change-password`-while-flagged as-is; do not add extra friction.**
The proposal flagged "should `POST /auth/change-password` require more than the current password
while `mustChangePassword` is true?" as an open question. Decision: **no additional requirement**.
The actual vulnerability was that the current password was *guessable* (the phone number), not
that requiring only the current password is inherently wrong — that's the standard "prove you
have the old secret" contract used everywhere else in this system's password change flow. Once the
temp credential is a random, admin-only-known secret, the same guarantee that already protects a
normal `changePassword` call now protects the first-login case too. Adding a second factor here
(e.g. requiring a prior successful "real" login before allowing self-service change) would be new
complexity solving a problem this change already closes at the source, and risks Admin/employee
self-lockout if the extra step is fumbled.

## Risks / Trade-offs

- **[Risk]** Admin mis-transcribes the 8-character code when relaying it verbally/on paper →
  **Mitigation**: unambiguous 32-char alphabet (no `0/O/1/I/L`); consider formatting the returned
  string in a `XXXX-XXXX` grouped form for readability (implementation detail, not a design
  constraint).
- **[Risk]** Employee doesn't log in within the TTL window and the Admin doesn't notice →
  **Mitigation**: this is a deliberate, visible failure mode (login is rejected with an actionable
  message) rather than the current silent-forever-valid state; Admins already have a re-issue path.
- **[Trade-off]** No automated out-of-band delivery (SMS/Zalo) means the Admin is still a manual
  step in the loop for every new employee. Accepted for this change; flagged as future work.

## Migration Plan

The project has not shipped to production yet (per CLAUDE.md / current dev-phase status), so there
is no real unclaimed-account data to preserve or backfill.

1. Prisma migration: add `mustChangePasswordExpiresAt DateTime?` to `User` (nullable, no default).
2. Reset the dev database (`pnpm db:reset`) instead of writing a data-backfill step — this drops
   and reapplies all migrations and reseeds, so every `User` row (including any old
   phone-derived-password accounts) is recreated cleanly under the new scheme. No backfill script,
   no down-migration concern for existing rows.
3. Ship `EmployeesService.create`'s new random-credential generation and the response field
   together with the new endpoint and the login-time expiry check — these are one deploy, not
   staged, since a half-migrated state (random credential but no expiry enforcement, or vice versa)
   doesn't meaningfully reduce risk on its own.
4. Revisit this section before the first production deploy — at that point a real backfill (or an
   accepted "force re-issue for all unclaimed accounts" runbook step) will be needed, since
   `db:reset` is a dev-only escape hatch.

## Open Questions

- Exact TTL default (proposed: 7 days) — confirm with product/ops; may want it configurable per
  deployment rather than a fixed constant, which `INITIAL_PASSWORD_TTL_DAYS` already allows.
- Whether the re-issue endpoint should also revoke any outstanding refresh tokens for the account
  (defense-in-depth if the original credential *was* somehow compromised before re-issue) — worth
  deciding during `tasks.md` / implementation rather than blocking design sign-off.
