## 1. Remove stale code in auth.service.ts

- [x] 1.1 Delete the commented-out `validateRefreshToken` call and the
      `if (!isValid)` guard above it in `refreshToken()`
      (`src/modules/auth/auth.service.ts`) — refresh tokens are already
      validated upstream by `JwtRefreshStrategy`/`RefreshTokenService`
      before this method runs, so the commented block is dead and misleads
      readers into thinking validation is missing.
- [x] 1.2 Delete the stale `// TODO: its'not completed yet, we also need to
      revoke the refresh token in database` comment above `logout()` — the
      line directly below it (`this.refreshTokenService.revokeRefreshToken(tokenId)`)
      already does this.

## 2. Remove stray root debug scripts

- [x] 2.1 Before deleting, extract the still-accurate parts of
      `test-refresh-tokens.md` (the endpoint list: login, refresh, logout-device,
      logout-all, active-sessions, and the rotate-on-refresh/hashed-storage
      behavior) into a short block comment at the top of
      `test/password-auth.e2e-spec.ts`, rewritten to match current field names
      (`phoneNumber`, not `username`) and current model shape (`RefreshToken.hashedToken`,
      no `revokedAt` column) — as documentation only, not new test cases.
- [x] 2.2 Delete `test-auth-module.js`, `test-refresh-token-fix.js`, and
      `test-refresh-tokens.md` from the repo root.

## 3. Verify

- [x] 3.1 Grep the repo for any remaining reference to the three deleted
      filenames (docs, scripts, package.json) and remove/update any found.
- [x] 3.2 Run `pnpm lint` and `pnpm test` and confirm no regressions.
      (Full `pnpm lint`: 13 pre-existing errors, none in files this change
      touched. Full `pnpm test`: 265/265 pass. Also ran `pnpm run build`,
      the `auth.service.spec.ts` unit suite, and the `password-auth`
      e2e suite directly against the edited `auth.service.ts` — all pass.)
