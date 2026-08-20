## Why

The access-control modules (`permissions`, `roles`, `role-permissions`) are the closest to the reference pattern but have small, easy-to-fix inconsistencies: `permissions/permisison.mapper.ts` has a typo'd filename, `roles/role.mappers.ts` uses a pluralized filename (every other module uses singular `<name>.mapper.ts`), and `role-permissions` has no `mapper.ts`/`types.ts` at all — it duplicates the same inline Prisma-to-DTO mapping logic in two service methods (`assignPermissions` and `getRolePermissions`) and imports `PrismaService` via a relative path (`../prisma/prisma.service`) instead of the `@modules/*` alias required elsewhere. Grouping these three together as one small cleanup change keeps the fix scoped and low-risk.

## What Changes

- Rename `permissions/permisison.mapper.ts` → `permissions/permission.mapper.ts` (class name `PermissionMapper` is already correct, only the filename has the typo).
- Rename `roles/role.mappers.ts` → `roles/role.mapper.ts` (class name `RoleMapper` is already correct, only the filename is pluralized).
- Add `role-permissions/role-permissions.types.ts` (the shared `include` const used by both `assignPermissions` and `getRolePermissions`) and `role-permissions/role-permissions.mapper.ts` (a single `RolePermissionMapper.toDto` replacing the duplicated inline `.map(...)` block in both methods).
- Fix the relative Prisma import in `role-permissions.service.ts` to use the `@modules/prisma/prisma.service` alias.
- Update every import site of the renamed files (`permisison.mapper.ts`, `role.mappers.ts`) across the codebase.
- No new endpoints, no field/permission/schema changes.

## Capabilities

### New Capabilities
- `access-control-crud-consistency`: documents the mapper/types contract and naming convention for `permissions`, `roles`, and `role-permissions`, and that existing behavior is preserved.

### Modified Capabilities
(none — no requirement text changes; see Impact for the note on shared source files with the existing `authorization` spec)

## Impact

- Code: `src/modules/permissions/`, `src/modules/roles/`, `src/modules/role-permissions/`, plus any file importing the two renamed mapper files (grep for `permisison.mapper` and `role.mappers` before renaming).
- No DB/schema changes, no API contract changes, no permission behavior changes.
- `authorization` is the one existing capability spec in this repo (`openspec/specs/authorization/spec.md`) and shares source files with `role-permissions`; this change does not alter any of its requirements, called out here for reviewer visibility only.
