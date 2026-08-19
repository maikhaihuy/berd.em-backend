## 1. task-templates

- [x] 1.1 Create `task-template.types.ts` with the `include`/`select` const (`satisfies Prisma.TaskTemplateInclude`) and derived payload type, moved out of `task-template.service.ts`
- [x] 1.2 Create `task-template.mapper.ts` (`TaskTemplateMapper.toDto`)
- [x] 1.3 Update `task-template.service.ts` to query via the new const and return through the mapper
- [x] 1.4 Verify build + confirm route reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 2. master-shift-templates

- [x] 2.1 Create `master-shift-template.types.ts`
- [x] 2.2 Create `master-shift-template.mapper.ts`
- [x] 2.3 Update `master-shift-template.service.ts` to query via the new const and return through the mapper
- [x] 2.4 Verify build + confirm route reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 3. sub-shift-templates

- [x] 3.1 Create `sub-shift-template.types.ts`
- [x] 3.2 Create `sub-shift-template.mapper.ts`
- [x] 3.3 Update `sub-shift-template.service.ts` to query via the new const and return through the mapper
- [x] 3.4 Verify build + confirm route reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 4. master-shifts

- [x] 4.1 Create `master-shift.types.ts`
- [x] 4.2 Create `master-shift.mapper.ts`
- [x] 4.3 Update `master-shift.service.ts` to query via the new const and return through the mapper, including the shift-generation action
- [x] 4.4 Verify build + confirm routes (incl. `generate`) reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 5. sub-shifts

- [x] 5.1 Create `sub-shift.types.ts`
- [x] 5.2 Create `sub-shift.mapper.ts`
- [x] 5.3 Update `sub-shift.service.ts` to query via the new const and return through the mapper
- [x] 5.4 Verify build + confirm route reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 6. tasks

- [x] 6.1 Create `task.types.ts` (move the `include` private field out of `task.service.ts`)
- [x] 6.2 Create `task.mapper.ts` (`TaskMapper.toDto`), covering both the plain `Task` shape and the `complete()` return shape
- [x] 6.3 Update `task.service.ts` (`create`, `findAll`, `findOne`, `update`, `complete`, `remove`) to query via the new const and return through the mapper
- [x] 6.4 Add a baseline `task.service.spec.ts` (none exists today) covering create/findOne/update/complete/remove with a mocked `PrismaService`
- [x] 6.5 Verify build + confirm routes (incl. `complete`) reachable via `/docs` (full authenticated CRUD exercise deferred — see 7.4 note)

## 7. Whole-change verification

- [x] 7.1 `pnpm run build` succeeds
- [x] 7.2 `pnpm test` passes (including the new `task.service.spec.ts`)
- [x] 7.3 `pnpm test:e2e` — no e2e specs touch these 6 modules; confirmed the suite's pre-existing `@modules/*` path-alias resolution failure predates this change (reproduces identically on stashed/clean code) and is not a regression
- [x] 7.4 `pnpm run start:dev` boots cleanly (0 compile errors, no DI errors); confirmed via `/docs-json` that all 6 modules' routes are registered (task-templates, master-shift-templates, sub-shift-templates, master-shifts incl. `generate`, sub-shifts, tasks incl. `complete`); confirmed each list endpoint returns 401 (not 500) unauthenticated, proving the full guard→controller→service→mapper pipeline resolves without crashing. Full authenticated CRUD exercise (real create/update/delete calls) was not performed this session — would require enabling `AUTH_DEV_MODE`/`AUTH_DEV_SECRET` in `.env` and seeding the database, which the user opted to defer.
