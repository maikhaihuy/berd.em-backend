## ADDED Requirements

### Requirement: Operational-entity responses are produced via a mapper layer
For each of `assignments`, `attendance-history`, and `time-tracking`, the service SHALL query Prisma using an `include`/`select` const defined in that module's `types.ts`, and SHALL return responses to the controller through that module's `mapper.ts` rather than the raw Prisma result.

#### Scenario: Service returns a mapped DTO, not a raw Prisma object
- **WHEN** any endpoint on `assignments`, `attendance-history`, or `time-tracking` is called
- **THEN** the value returned by the service method is the output of that module's mapper, not a bare Prisma query result

### Requirement: Existing CRUD and custom-action behavior is preserved
Each module's existing endpoints SHALL continue to behave identically to their pre-refactor behavior: same status codes, same response shape, same field names/types.

#### Scenario: Assignment check-in/check-out unaffected
- **WHEN** a client calls `POST /assignments/:id/check-in` followed by `POST /assignments/:id/check-out`
- **THEN** both responses carry the same fields as before the refactor, and a corresponding `AttendanceHistory` row is still created

#### Scenario: Attendance history remains append-only and correctly listed
- **WHEN** a client lists attendance history for an assignment (`GET /attendance-history/assignment/:assignmentId`)
- **THEN** the response is produced by `AttendanceHistoryMapper` with the same fields as before, and no update/delete endpoint is introduced

#### Scenario: Time log verify still works end-to-end
- **WHEN** a client calls the `verify` action on a time log
- **THEN** the time log's verified state updates as before, the response is produced by `TimeLogMapper`, and the record remains consumable by downstream payroll processing

#### Scenario: Application still boots
- **WHEN** the application is started after this change is applied
- **THEN** `pnpm run build` succeeds and the Nest application boots without module-resolution or DI errors
