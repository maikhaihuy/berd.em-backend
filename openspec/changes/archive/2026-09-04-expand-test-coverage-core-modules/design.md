## Context

Eight modules make up the bulk of the untested surface area: `branches`, `employee-hourly-rates`,
`master-shift-templates`, `sub-shift-templates`, `task-templates`, `master-shifts` (zero unit
coverage), plus `employees` and `sub-shifts` (each has exactly one narrow spec added by an
unrelated feature change, covering neither CRUD nor validation). Investigation for this change
found the eight modules split cleanly into two families by how they read data:

- **Plain CRUD** (`branches`, `employee-hourly-rates`): no ability/row-scoping in the service at
  all — `findAll`/`findOne` are unconditioned `prisma.<model>.findMany/findUnique`, and
  `@RequirePermissions` on the controller is the only guard. `create`/`update`/`remove` catch
  `P2002`/`P2025` and rethrow as `BadRequestException`/`NotFoundException`, per the project's
  standard no-soft-delete convention.
- **Ability-scoped** (`master-shift-templates`, `sub-shift-templates`, `task-templates`,
  `master-shifts`, plus the two partially-covered `employees`/`sub-shifts`): `findAll`/`findOne`
  take an `AppAbility` and merge `accessibleWhere(ability, 'read', SUBJECT)` into the Prisma
  `where`, exactly like `MasterShiftsService` (documented in `CLAUDE.md`). `create`/`update`/
  `remove` are unscoped by ability — consistent across every one of these modules, not a gap
  specific to any single one.

Two test patterns are already established in this codebase for these two families, both written
this session and in `branch-schedule-config.service.spec.ts`:

- Plain CRUD → construct the service directly (`new XService(prismaMock)`), mock only the Prisma
  methods actually called, assert on thrown exception types and `toHaveBeenCalledWith` shapes.
- Ability-scoped → additionally build one or two real `AppAbility` instances via
  `new CaslAbilityFactory({ warn: jest.fn() } as unknown as LoggerService).createForUser({...})`
  (an `unscopedAbility` with a bare grant, and where relevant a conditioned one), then assert the
  service's Prisma call received `where: expect.objectContaining({ AND: [accessibleWhere(ability,
  'read', SUBJECT)] })` — importing the real `accessibleWhere` helper rather than hand-deriving
  the expected shape, so the test tracks the real resolver instead of duplicating its logic.

`employees` already uses `Test.createTestingModule` with DI-provided mocks (`PrismaService`,
`PasswordService`, `AuditLogsService`, `ConfigService`) rather than direct construction, since
`EmployeesService.create` depends on three collaborators beyond Prisma. Extending it means adding
`describe` blocks and mocked Prisma methods (`findFirst`, `update`, `delete`,
`employeeHourlyRate.*`) to that existing setup, not introducing a second file or pattern.

`EmployeesService.syncHourlyRates` and `BranchesService`'s large commented-out `syncShifts`/
`findShifts` block are worth flagging: `syncHourlyRates` does real create/update/delete diffing
inside a `$transaction` and is exactly the kind of logic this proposal's "authorization-relevant
branching" bar is meant to catch — it gets its own test group. The commented-out dead code in
`branch.service.ts` is the same category of cruft the (now-archived) `cleanup-auth-dead-code-and-
stray-files` change addressed for `auth.service.ts`, but it's out of scope here — this change adds
tests, it doesn't touch unrelated code, and removing it is a one-line decision better proposed on
its own.

## Goals / Non-Goals

**Goals:**
- Bring `branches`, `employee-hourly-rates`, `master-shift-templates`, `sub-shift-templates`,
  `task-templates`, and `master-shifts` each up to the proposal's bar: create/update validation,
  not-found handling, and (for the ability-scoped four) `accessibleWhere` scoping on
  `findAll`/`findOne`.
- Extend `employee.service.spec.ts` with `findAll`/`findOne` (ability-scoped + not-found),
  `update` (phone-uniqueness check, branch resync), `remove` (not-found), and `syncHourlyRates`
  (create-only, update-only, delete-only, and mixed-diff cases).
- Extend `sub-shift.service.spec.ts` with `create` (master-shift/template-branch validation,
  time-range validation), `update`, and `remove`.
- Add `test/employees.e2e-spec.ts` and `test/branches.e2e-spec.ts` covering full CRUD over real
  HTTP, plus `employees`' branch-assignment-on-create and duplicate-phone rejection, and
  `branches`' duplicate name/abbreviation rejection.

**Non-Goals:**
- No behavior changes to any service under test — this is test-only, like the archived
  `cleanup-auth-dead-code-and-stray-files` change's "(none)" capabilities.
- No new ability/row-scoping on `create`/`update`/`remove` for any module — that gap is real
  (noted in `branch-scope-subshift-task-permissions`'s design.md as an accepted, pre-existing
  trade-off) but changing it is a behavior change, out of scope for a test-coverage change.
- No controller-level unit specs for these eight modules — only three modules in the whole
  codebase have one (`auth`, `roles`, `users`), none of them in this set; adding controller specs
  here would be a new convention, not filling an existing gap.
- No cleanup of the commented-out `syncShifts`/`findShifts` block in `branch.service.ts` — flagged
  above, left for a dedicated cleanup change.
- No e2e specs for `employee-hourly-rates`, the four templates modules, or `master-shifts` — the
  proposal scopes dedicated e2e coverage to `employees`/`branches` specifically ("core entity"
  modules); the other six get unit coverage only in this change.

## Decisions

**Reuse the two existing mocking patterns verbatim, keyed to whether the service ability-scopes.**
Concretely: `branches`, `employee-hourly-rates` get the direct-construction plain-Prisma-mock
pattern (`branch-schedule-config.service.spec.ts` shape); `master-shift-templates`,
`sub-shift-templates`, `task-templates`, `master-shifts` get the same shape plus the
`CaslAbilityFactory`/`accessibleWhere` assertions on `findAll`/`findOne` (the `sub-shift.service.
spec.ts`/`task.service.spec.ts` shape from earlier this session). No new test infrastructure or
helper module — copying an established, working pattern six more times is preferable to
abstracting it into a shared test helper for a one-time batch of specs.

**Extend rather than rewrite `employee.service.spec.ts`.** It already has the right DI-based
scaffold for `EmployeesService`'s multi-collaborator constructor; new `describe` blocks slot in
next to the existing `create` block, reusing `beforeEach`'s already-mocked `prismaService`/
`auditLogsService` and adding the additional Prisma methods each new test needs (e.g.
`employee.findFirst`, `employeeHourlyRate.findMany/createMany/update/deleteMany`).

**New e2e specs, not extensions of existing ones.** `employees`/`branches` routes are currently
touched only as incidental fixture setup inside five unrelated e2e specs (see the proposal's
Why). A dedicated `employees.e2e-spec.ts`/`branches.e2e-spec.ts`, structured like the existing
`branch-schedule-config.e2e-spec.ts` (real app bootstrap, admin token via seeded login, create
fixtures in `beforeAll`, clean up in `afterAll`), keeps CRUD-focused assertions in one place rather
than scattered further across specs whose primary subject is something else.

**Test `syncHourlyRates`'s diffing logic directly, not just its call sites.** It's the one piece of
non-trivial branching among these eight modules (three-way create/update/delete split from a
single upsert-list DTO, inside a `$transaction`) — the proposal's "authorization-relevant
branching" bar generalizes to "meaningfully-branching logic" here since none of these modules have
literal authorization branches beyond the already-covered `accessibleWhere` calls.

## Risks / Trade-offs

- **[Risk]** Eight modules is a large batch; a single session may not finish all of them.
  → Mitigation: the proposal is explicitly tagged `Priority: low (ongoing)` — `tasks.md` orders
  work so each module's tests are independently completable and committable, and partial progress
  (e.g. finishing the six zero-coverage unit specs but not the two e2e specs) still leaves the repo
  strictly better covered than before.
- **[Risk]** Copying the `CaslAbilityFactory`-based pattern four more times duplicates boilerplate
  (the `unscopedAbility` construction) across files. → Mitigation: accepted per the "Reuse... no
  new test infrastructure" decision above — four to six near-identical lines of setup per file is
  cheaper to read than a shared fixture module for a batch of specs that won't be added to again
  once this change lands.
- **[Trade-off]** Testing only `findAll`/`findOne` ability-scoping (not `create`/`update`/`remove`)
  mirrors a real, accepted gap in production code rather than a test-suite shortfall — a future
  change that adds mutation-level scoping will need to add the corresponding tests then, not this
  change's job to anticipate.

## Migration Plan

Not applicable — test-only change, no runtime code paths altered, nothing to deploy or roll back
beyond the new/extended spec files themselves.
