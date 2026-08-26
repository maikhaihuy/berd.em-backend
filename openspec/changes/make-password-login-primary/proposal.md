## Why

The frontend direction changed: `staffhub-frontend` is now a web dashboard for Admin, Manager,
and Staff (not a Zalo Mini App), with password login meant to be primary and Zalo a
secondary/optional identity link — Zalo stays primary only for the separate, not-yet-started
Zalo Mini App repo.

The backend today is the opposite, and more importantly, password login isn't actually usable
end-to-end yet:

- `POST /auth/login` (`LocalAuthGuard`) exists and works, but the Users create/update DTOs have
  **no `password` field at all** — there is currently no product flow for an Admin to give a new
  User an initial password. The only way a User gets a working password today is directly in the
  database (e.g. via seed).
- `forgotPassword`/`resetPassword` were fully removed from `AuthService` (commented out with
  `// DEPRECATED: Password reset methods - no longer needed with Zalo auth`) and have no
  controller routes — a User who forgets their password has no recovery path. The two DTOs for
  this (`forgot-password.dto.ts`, `reset-password.dto.ts`) still sit in
  `src/modules/auth/dto/` unused.
- Zalo login (`POST /auth/login/zalo`) only works as a *login* path for a pre-existing `User`
  matched by phone — there's no way for an already-password-authenticated User to *link* a Zalo
  identity separately, which the web dashboard needs for its planned optional "link your Zalo
  account" action.

## What Changes

- Add a `password` field (write-only, optional on create, settable on update) to the Users
  create/update DTOs so an Admin/Owner can set an initial password when provisioning a new User —
  hashed via the existing password-hashing service before persisting.
  - **Note**: there appear to be two password-hashing services —
    `src/modules/auth/password.service.ts` and `src/common/services/password.service.ts`.
    Confirm which is actually used by the login path today and consolidate to one rather than
    introducing a third caller of whichever is currently unused (flag as a `design.md` question).
- Restore `forgotPassword`/`resetPassword` on `AuthService` and their controller routes
  (`POST /auth/forgot-password`, `POST /auth/reset-password`), using the existing
  `PasswordResetToken` Prisma model and the two already-present-but-unused DTOs — implement them
  for real instead of leaving them as dead files.
  - **Fix while restoring**: the original implementation (before it was deprecated) looked up
    `PasswordResetToken` via an unscoped `findFirst({ where: { expiresAt: { gt: new Date() } } })`
    — not scoped by the submitted token or user — which breaks with more than one outstanding
    reset request. Scope the lookup correctly this time; don't reintroduce the old bug.
- Add rate limiting to `POST /auth/login`, `POST /auth/forgot-password`, and
  `POST /auth/reset-password`. **This overlaps with the already-drafted
  `harden-api-security-perimeter` proposal** — land whichever lands first and have the other
  reference it rather than duplicating the throttler config.
- Add an **authenticated** Zalo-linking endpoint (e.g. `POST /auth/link/zalo`), distinct from the
  existing public `POST /auth/login/zalo`, so a password-authenticated User can optionally attach
  a `ZaloIdentity` for future use by the separate Zalo Mini App — without Zalo being required to
  use this dashboard.
- Once the above is implemented and tested, update the Auth sections of `CLAUDE.md`, `AGENTS.md`,
  and `openspec/project.md` to describe password login as primary and Zalo as secondary — per
  this repo's own convention of syncing those docs as part of `/opsx:apply`/`/opsx:archive`, not
  ahead of the code.

**Supersedes**: the DTO-deletion item in the `cleanup-auth-dead-code-and-stray-files` proposal
(`forgot-password.dto.ts` / `reset-password.dto.ts` should **not** be deleted — they're revived
here instead).

## Capabilities

### New Capabilities
- `password-account-recovery`: a User can be given an initial password on creation and can
  recover a forgotten password through a token-based reset flow, scoped correctly per request.
- `zalo-account-linking`: an authenticated User can link a `ZaloIdentity` independent of how they
  logged in, decoupling "which method you log in with" from "whether Zalo is linked."

### Modified Capabilities
- `authentication`: no living spec currently covers the login/auth flow end-to-end —
  `openspec/specs/authorization/spec.md` only mentions login endpoints in passing as examples.
  Consider adding `openspec/specs/authentication/spec.md` as part of this change so the
  password-primary / Zalo-secondary behavior has a real synced spec going forward, not just
  `CLAUDE.md`/`AGENTS.md` narrative docs.

## Impact

- `src/modules/users/dto/create-user.dto.ts`, `update-user.dto.ts` (or equivalent), and
  `src/modules/users/users.service.ts` (password hashing on create/update).
- `src/modules/auth/auth.service.ts` (restore `forgotPassword`/`resetPassword` with the lookup
  fix), `src/modules/auth/auth.controller.ts` (restore the two routes), and the existing
  `src/modules/auth/dto/forgot-password.dto.ts` / `reset-password.dto.ts` (kept, not deleted).
- `prisma/schema.prisma` — verify the existing `PasswordResetToken` model has what's needed
  (hashed token, expiry, `userId`) or extend it via a migration.
- New authenticated Zalo-linking endpoint, likely alongside the existing
  `src/modules/auth/zalo-auth.service.ts`.
- `src/modules/auth/password.service.ts` vs `src/common/services/password.service.ts` —
  resolve the apparent duplication (`design.md` question).
- Rate limiting: coordinate with `harden-api-security-perimeter` rather than duplicating.
- Docs: `CLAUDE.md`, `AGENTS.md`, `openspec/project.md` Auth sections — update after
  implementation, per repo convention.

**Recommend a `design.md` before `openspec apply`** — the password-service duplication and
whether `PasswordResetToken` needs a schema change are real open questions, not implementation
details.
