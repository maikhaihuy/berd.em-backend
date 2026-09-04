_Priority: low (ongoing)_

## Why
29 unit specs and 11 e2e specs now exist — a large improvement — but `branches`,
`employee-hourly-rates`, `master-shift-templates`, `sub-shift-templates`, `task-templates`, and
`master-shifts` (six of the modules proposal L wants to refactor) still have zero unit test
coverage. Changing behavior in any of these today has no safety net.

**Corrected 2026-09-04**: this proposal previously described all 8 target modules as having "zero
test coverage." Two have since gained narrow specs from unrelated changes: `employees`
(`employee.service.spec.ts`, 2 tests, both scoped to the `auto-provision-user-on-employee-create`
feature) and `sub-shifts` (`sub-shift.service.spec.ts`, 2 tests, both scoped to the
`branch-scope-subshift-task-permissions` ability-filtering feature). Neither covers this
proposal's actual bar — create/update validation, not-found handling, or general
authorization-relevant branching — so both remain in scope for _added_ coverage, not net-new spec
files. The e2e claim also needs a caveat: individual `employees`/`branches` routes
(`POST`/`GET`/`DELETE`) are incidentally exercised as fixture setup inside several unrelated e2e
specs (`auto-provision-user-on-employee-create`, `reissue-initial-password`,
`rbac-multi-role-managed-branches`, `branch-schedule-config`, `validation-error-response`), but no
spec exercises full CRUD (no `PATCH`, no list-filtering) or the entity-specific behavior
(`employees`' branch assignment + hourly-rate sync via `$transaction`) as its own concern — that
gap is still real.

## What Changes

- Add unit specs for `branches`, `employee-hourly-rates`, `master-shift-templates`,
  `sub-shift-templates`, `task-templates`, and `master-shifts` (currently zero coverage) covering
  at minimum: create/update validation, not-found handling, and any authorization-relevant
  branching.
- Extend the existing `employees` and `sub-shifts` unit specs with the same baseline (they
  currently only cover one narrow, unrelated feature each).
- Add dedicated e2e coverage for `employees` and `branches` — the two "core entity" modules —
  covering full CRUD and, for `employees`, the branch-assignment/hourly-rate-sync transaction,
  since no existing e2e spec treats either as its own subject.

## Capabilities
(none)

## Impact
`src/modules/employees/employee.service.spec.ts` (extend), `src/modules/sub-shifts/sub-shift.service.spec.ts`
(extend), `branches/*.spec.ts`, `employee-hourly-rates/*.spec.ts`, `master-shift-templates/*.spec.ts`,
`sub-shift-templates/*.spec.ts`, `task-templates/*.spec.ts`, `master-shifts/*.spec.ts` (new),
`test/*.e2e-spec.ts` (new `employees` and `branches` e2e specs).
