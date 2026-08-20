## 1. attendance-history

- [x] 1.1 Create `attendance-history.types.ts` with the `include`/`select` const, moved out of `attendance-history.service.ts`
- [x] 1.2 Create `attendance-history.mapper.ts` (`AttendanceHistoryMapper.toDto`)
- [x] 1.3 Update `attendance-history.service.ts` to query via the new const and return through the mapper
- [x] 1.4 Verify build + manually exercise create/list-by-assignment/get/list via `/docs`

## 2. assignments

- [x] 2.1 Create `assignment.types.ts`
- [x] 2.2 Create `assignment.mapper.ts` (`AssignmentMapper.toDto`)
- [x] 2.3 Update `assignment.service.ts` (`create`, `findAll`, `findOne`, `update`, `checkIn`, `checkOut`, `remove`) to query via the new const and return through the mapper
- [x] 2.4 Verify build + manually exercise create/list/get/update/check-in/check-out/delete via `/docs`, confirming `AttendanceHistory` rows are still logged

## 3. time-tracking

- [x] 3.1 Create `time-tracking.types.ts` (Prisma model is `TimeLog`)
- [x] 3.2 Create `time-tracking.mapper.ts` (`TimeLogMapper.toDto`)
- [x] 3.3 Update `time-tracking.service.ts` (`create`, `findAll`, `findByEmployee`, `findByAssignment`, `findOne`, `update`, `verify`, `remove`) to query via the new const and return through the mapper
- [x] 3.4 Verify build + manually exercise create/list/get/update/verify/delete via `/docs`

## 4. Whole-change verification

- [x] 4.1 `pnpm run build` succeeds
- [x] 4.2 `pnpm test` passes for all 3 modules
- [x] 4.3 `pnpm test:e2e` passes for any e2e specs touching these 3 modules
- [x] 4.4 `pnpm run start:dev` boots without DI/module errors; manually walk check-in → check-out → time-log verify via `/docs`
