_Priority: low (ongoing)_

## Why
30 unit specs and 7 e2e specs now exist — a large improvement — but `employees`, `branches`,
`employee-hourly-rates`, and all five shift/template modules (the ones proposal L wants to
refactor) still have zero test coverage. Changing behavior in any of these today has no safety
net.

## What Changes
- Add unit specs for each of the 7 untested modules covering at minimum: create/update
  validation, not-found handling, and any authorization-relevant branching.
- Add e2e coverage for `employees` and `branches` specifically — the two "core entity" modules —
  since nothing currently exercises their full request/response cycle.

## Capabilities
(none)

## Impact
`src/modules/employees/*.spec.ts`, `branches/*.spec.ts`, `employee-hourly-rates/*.spec.ts`,
`master-shift-templates/*.spec.ts`, `sub-shift-templates/*.spec.ts`, `task-templates/*.spec.ts`,
`master-shifts/*.spec.ts`, `sub-shifts/*.spec.ts`, `test/*.e2e-spec.ts`.
