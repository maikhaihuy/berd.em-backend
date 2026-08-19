## Why

`assignments`, `attendance-history`, and `time-tracking` (the `TimeLog` module) return raw Prisma results directly from service to controller, with inline `include` objects, instead of following the `employees`/`branches` reference pattern (`<name>.types.ts` + `<name>.mapper.ts`) documented in `CLAUDE.md`. These three modules sit on the day-to-day operational path (check-in/check-out, attendance logging, time-log verification feeding payroll) and are grouped together as a second, smaller retrofit change separate from the shift/task template domain.

## What Changes

- Add `<name>.types.ts` and `<name>.mapper.ts` to `assignments`, `attendance-history`, and `time-tracking`, following the pattern used in `employees`/`branches` (and matching the sibling change `retrofit-shift-task-crud-mappers`).
- Update each service (`AssignmentsService`, `AttendanceHistoryService`, `TimeTrackingService`) to query via the new types.ts consts and return through the mapper, including custom actions: `assignments` check-in/check-out, `time-tracking` verify.
- No new endpoints, no field/permission/schema changes.

## Capabilities

### New Capabilities
- `operational-entities-crud-consistency`: documents the mapper/types contract for `assignments`, `attendance-history`, and `time-tracking`, and that existing CRUD + custom-action behavior is preserved.

### Modified Capabilities
(none — no existing capability spec covers these modules yet, and no request/response behavior changes)

## Impact

- Code: `src/modules/assignments/`, `src/modules/attendance-history/`, `src/modules/time-tracking/` (service + new mapper.ts/types.ts in each).
- No DB/schema changes, no API contract changes.
- Depends on nothing from `retrofit-shift-task-crud-mappers` (different modules) but should land after it so both changes' `.mapper.ts` files follow one settled convention rather than drifting.
