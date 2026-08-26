_Priority: low (internal refactor)_

## Why
`master-shift-templates`, `sub-shift-templates`, `task-templates`, `master-shifts`, and
`sub-shifts` each independently reimplement near-identical create/find/update/remove/mapper
logic (~1,000 combined lines of duplication). This is working code, not broken, but every future
cross-cutting change (audit logging, soft delete, a new common field) has to be made five times
and can drift.

## What Changes
- Extract a shared generic base service (and mapper base, if the mapping shape is genuinely
  common) that the five modules extend/compose — e.g. a generic `PrismaCrudService<T>`.
- Migrate the five modules one at a time behind their existing test suites. Only 2 of 5
  currently have specs (see proposal M) — land test coverage first or alongside, so this
  refactor has a safety net.

## Capabilities
(none — internal refactor, no external behavior change)

## Impact
`src/modules/master-shift-templates/*`, `sub-shift-templates/*`, `task-templates/*`,
`master-shifts/*`, `sub-shifts/*`, a new shared base (e.g. `src/common/crud/`).
