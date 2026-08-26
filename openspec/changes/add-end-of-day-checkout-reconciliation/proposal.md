_Priority: medium_

## Why
The spec requires that when an employee checks out multiple times in a shift, an end-of-day job
selects the final checkout as official. Today there's no `@nestjs/schedule` dependency and no
cron job at all — `Assignment.actualEndTime`/`status` is overwritten by whichever `checkOut`
call is *processed* last, which is last-write-wins by request arrival order, not by actual
checkout time. Out-of-order delivery (retries, network delay) can leave an earlier checkout
marked official over a later, real one.

## What Changes
- Add `@nestjs/schedule` and register its module — verify the naming doesn't collide with the
  existing business `src/modules/schedule`-adjacent modules before wiring it in.
- Add a daily cron job that, for each `Assignment` with more than one `AttendanceHistory`
  checkout row for the day, selects the row with the latest *actual* checkout timestamp (not
  latest insert order) and marks it official, updating `Assignment` accordingly.
- Add a manual "reconcile now" admin endpoint for re-running the job on demand.

## Capabilities
**New:** `end-of-day-checkout-reconciliation` — a scheduled job that selects the final,
time-latest checkout per assignment as official, superseding request-arrival-order.
**Modified:** (none)

## Impact
`package.json` (new dep), `src/app.module.ts`, a new cron service under
`src/modules/attendance-history` or `src/modules/assignments`, `prisma/schema.prisma` (possible
`isOfficial`-style flag on `AttendanceHistory`/`Assignment`).
