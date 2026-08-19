## 1. Module scaffolding

- [ ] 1.1 Create `src/modules/branch-schedule-configs/` with `branch-schedule-config.module.ts`, `branch-schedule-config.controller.ts`, `branch-schedule-config.service.ts`, `branch-schedule-config.mapper.ts`, `branch-schedule-config.types.ts`, `dto/create-branch-schedule-config.dto.ts`, `dto/update-branch-schedule-config.dto.ts`
- [ ] 1.2 Implement CRUD (`create`/`findAll`/`findOne`/`findByBranch`/`update`/`remove`) in the service, mapped through the mapper
- [ ] 1.3 Add `@RequirePermissions` on every route (`create`/`read`/`update`/`delete`, subject `branch-schedule-configs`)
- [ ] 1.4 Register `BranchScheduleConfigsModule` in `src/app.module.ts`

## 2. Permission seeding

- [ ] 2.1 Add `branch-schedule-configs` permission rows (`create`/`read`/`update`/`delete`) to `prisma/seed.ts`
- [ ] 2.2 Decide and apply role grants
- [ ] 2.3 Run `pnpm db:seed` (or `pnpm db:reset`) locally to confirm the seed applies cleanly

## 3. Tests

- [ ] 3.1 Unit tests for the service: create, findOne, findByBranch (found + 404), update, delete, duplicate-branch rejection (`P2002` → 400)
- [ ] 3.2 e2e coverage for create → get → get-by-branch → update → delete

## 4. Whole-change verification

- [ ] 4.1 `pnpm run build` succeeds
- [ ] 4.2 `pnpm test` passes (new specs from section 3)
- [ ] 4.3 `pnpm test:e2e` passes
- [ ] 4.4 `pnpm run start:dev` boots without DI/module errors; module's routes appear in `/docs`
