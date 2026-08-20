## 1. permissions filename fix

- [x] 1.1 Grep `src/` for every import of `permisison.mapper` (note the typo) to find all call sites
- [x] 1.2 Rename `permissions/permisison.mapper.ts` → `permissions/permission.mapper.ts` (class `PermissionMapper` unchanged)
- [x] 1.3 Update all import sites found in 1.1
- [x] 1.4 Verify build

## 2. roles filename fix

- [x] 2.1 Grep `src/` for every import of `role.mappers` to find all call sites
- [x] 2.2 Rename `roles/role.mappers.ts` → `roles/role.mapper.ts` (class `RoleMapper` unchanged)
- [x] 2.3 Update all import sites found in 2.1
- [x] 2.4 Verify build

## 3. role-permissions mapper/types extraction

- [x] 3.1 Create `role-permissions.types.ts` with the shared `rolePermissionInclude` const (currently duplicated inline in `assignPermissions` and `getRolePermissions`)
- [x] 3.2 Create `role-permissions.mapper.ts` (`RolePermissionMapper.toDto`) matching the existing inline `.map()` output shape exactly
- [x] 3.3 Update `role-permissions.service.ts` to use the new const/mapper in both `assignPermissions` and `getRolePermissions`
- [x] 3.4 Fix the `../prisma/prisma.service` import in `role-permissions.service.ts` to use `@modules/prisma/prisma.service`
- [x] 3.5 Verify build + manually exercise assign/list/remove-one/remove-all via `/docs`

## 4. Whole-change verification

- [x] 4.1 `pnpm run build` succeeds
- [x] 4.2 `pnpm test` passes, including existing `role.controller.spec.ts` / `role.service.spec.ts`
- [x] 4.3 `pnpm run start:dev` boots without DI/module errors
