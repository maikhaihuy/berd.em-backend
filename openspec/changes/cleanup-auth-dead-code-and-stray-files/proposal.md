## Why

A few small pieces of leftover cruft make the auth module harder to trust at a glance: stale
comments that misdescribe already-correct behavior (a commented-out `validateRefreshToken` call
reads as if refresh validation is missing when it isn't; a logout TODO says revocation "needs"
doing directly above the line that already does it), and three stray root-level debug scripts
(`test-auth-module.js`, `test-refresh-token-fix.js`, `test-refresh-tokens.md`) from an old
refresh-token incident that reference fields no longer in the schema.

**Corrected 2026-08-26**: this proposal previously also called for deleting
`forgot-password.dto.ts` / `reset-password.dto.ts` as unused dead files. That item is removed —
proposal `make-password-login-primary` revives and implements both, so they're no longer dead
code. Do not delete them.

## What Changes

- Remove the stale commented-out code and inaccurate TODO in `src/modules/auth/auth.service.ts`.
- Delete the three stray root files; fold anything still useful from
  `test-refresh-tokens.md` into a real e2e test comment instead.

**Supersedes note**: do NOT delete `forgot-password.dto.ts` / `reset-password.dto.ts` — see
`make-password-login-primary`, which restores real `forgotPassword`/`resetPassword` behavior
using those two DTOs.

## Capabilities

(none — pure cleanup)

## Impact

`src/modules/auth/auth.service.ts`, repo root files (`test-auth-module.js`,
`test-refresh-token-fix.js`, `test-refresh-tokens.md`).
