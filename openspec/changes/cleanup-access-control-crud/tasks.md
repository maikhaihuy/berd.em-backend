## 1. permissions filename fix

- [ ] 1.1 Grep `src/` for every import of `permisison.mapper` (note the typo) to find all call sites
- [ ] 1.2 Rename `permissions/permisison.mapper.ts` → `permissions/permission.mapper.ts` (class `PermissionMapper` unchanged)
- [ ] 1.3 Update all import sites found in 1.1
- [ ] 1.4 Verify build

## 2. roles filename fix

- [ ] 2.1 Grep `src/` for every import of `role.mappers` to find all call sites
- [ ] 2.2 Rename `roles/role.mappers.ts` → `roles/role.mapper.ts` (class `RoleMapper` unchanged)
- [ ] 2.3 Update all import sites found in 2.1
- [ ] 2.4 Verify build

## 3. role-permissions mapper/types extraction

- [ ] 3.1 Create `role-permissions.types.ts` with the shared `rolePermissionInclude` const (currently duplicated inline in `assignPermissions` and `getRolePermissions`)
- [ ] 3.2 Create `role-permissions.mapper.ts` (`RolePermissionMapper.toDto`) matching the existing inline `.map()` output shape exactly
- [ ] 3.3 Update `role-permissions.service.ts` to use the new const/mapper in both `assignPermissions` and `getRolePermissions`
- [ ] 3.4 Fix the `../prisma/prisma.service` import in `role-permissions.service.ts` to use `@modules/prisma/prisma.service`
- [ ] 3.5 Verify build + manually exercise assign/list/remove-one/remove-all via `/docs`

## 4. Whole-change verification

- [ ] 4.1 `pnpm run build` succeeds
- [ ] 4.2 `pnpm test` passes, including existing `role.controller.spec.ts` / `role.service.spec.ts`
- [ ] 4.3 `pnpm run start:dev` boots without DI/module errors
