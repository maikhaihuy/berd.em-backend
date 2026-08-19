## ADDED Requirements

### Requirement: Shift/task domain responses are produced via a mapper layer
For each of `master-shift-templates`, `sub-shift-templates`, `task-templates`, `master-shifts`, `sub-shifts`, and `tasks`, the service SHALL query Prisma using an `include`/`select` const defined in that module's `types.ts` (`satisfies Prisma.XInclude`), and SHALL return responses to the controller through that module's `mapper.ts` (`XMapper.toDto`) rather than the raw Prisma result.

#### Scenario: Service returns a mapped DTO, not a raw Prisma object
- **WHEN** any create/read/update endpoint on one of the 6 modules is called
- **THEN** the value returned by the service method is the output of that module's mapper, not a bare Prisma query result

### Requirement: Existing CRUD behavior is preserved across the refactor
Each of the 6 modules' full CRUD operations (create, list, get-by-id, update, delete) and any custom actions (`master-shifts` generation, `tasks.complete`) SHALL continue to behave identically to their pre-refactor behavior: same HTTP status codes, same success/error response shape, same field names and types in the response body.

#### Scenario: CRUD round-trip is unaffected by the refactor
- **WHEN** a client creates, reads, updates, and deletes a record through any of the 6 modules' endpoints, exactly as it could before this change
- **THEN** every response has the same status code and the same set of fields/types as it did before the mapper/types.ts refactor

#### Scenario: Task completion still works end-to-end
- **WHEN** a client calls `POST /tasks/:id/complete` with valid evidence
- **THEN** the task status transitions to `COMPLETED`, a `TaskCompletion` record is upserted, and the response is produced by `TasksMapper` with the same fields as before the refactor

#### Scenario: Application still boots
- **WHEN** the application is started after this change is applied
- **THEN** `pnpm run build` succeeds and the Nest application boots without module-resolution or DI errors
