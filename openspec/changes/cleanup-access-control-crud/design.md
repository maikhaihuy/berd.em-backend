## Context

`permissions` and `roles` already have `mapper.ts`/`types.ts`-equivalent files but with off-pattern filenames (typo, pluralization). `role-permissions` has neither — `role-permissions.service.ts` builds its response DTO inline via `.map(...)` in two separate methods (`assignPermissions`, `getRolePermissions`), with the same `include: { role: {...}, permission: {...} }` shape repeated in both Prisma calls, and imports `PrismaService` with a relative path (`../prisma/prisma.service`) rather than the `@modules/*` alias `CLAUDE.md` requires elsewhere.

This is the smallest of the five changes — a rename + a small dedup, not a structural rework.

## Goals / Non-Goals

**Goals:**
- Consistent filenames: `<name>.mapper.ts` / `<name>.types.ts` singular, matching every other module.
- `role-permissions` gets the same mapper/types split as the rest, removing the duplicated inline mapping.
- Fix the stray relative Prisma import while touching this file.

**Non-Goals:**
- Not touching `PermissionMapper`/`RoleMapper` class internals — only filenames and import sites change.
- Not changing `authorization` spec requirements.

## Decisions

- Renames are done as filename-only changes; class names (`PermissionMapper`, `RoleMapper`) stay as-is since they're already correctly named — only the file on disk and its import sites move.
- `role-permissions.types.ts` exports one `rolePermissionInclude` const reused by both `assignPermissions` and `getRolePermissions` (today each defines its own identical inline `include` object).
- `role-permissions.mapper.ts` exports `RolePermissionMapper.toDto`, replacing both inline `.map(...)` blocks with a single call site each.
- The `../prisma/prisma.service` → `@modules/prisma/prisma.service` import fix is bundled here since it's in the same file being touched for the mapper extraction, not spun into a separate change.

## Risks / Trade-offs

- [Risk] Renaming `permisison.mapper.ts` / `role.mappers.ts` breaks an import elsewhere if a site is missed → Mitigation: grep the whole `src/` tree for both exact filenames (not just the class names, which stay the same) before and after the rename, and rely on `pnpm run build` (TypeScript) to catch any missed import.
- [Risk] Consolidating two mapping call sites in `role-permissions.service.ts` into one mapper could silently change field order or drop a field if not diffed carefully → Mitigation: keep the mapper's output object shape byte-for-byte identical to today's inline `.map()` return value.

## Migration Plan

No data migration. Pure rename + refactor. Verify via `pnpm run build`, `pnpm test`, and a manual check of `/roles/:id/permissions` assign/list/remove endpoints via `/docs`. Rollback is a plain revert.

## Open Questions

None currently.
