---
name: schema-review
description: 'Review, validate, and design database schemas: relationships, indexes, constraints, migrations. Use when: auditing schema structure, proposing new entities, reviewing schema changes, optimizing indexes, detecting N+1 patterns, preventing data integrity issues.'
argument-hint: 'Ask "Review this schema change for issues" or "Audit the database schema for optimization"'
---

# Schema Design & Review Guide

Comprehensive patterns for designing, validating, and optimizing Prisma schemas in PostgreSQL, following this project's actual conventions in `prisma/schema.prisma`.

## When to Use

- **New entities**: Design relationships, constraints, and indexes upfront
- **Schema changes**: Validate proposed changes before migration
- **Performance**: Detect missing indexes, N+1 query patterns
- **Data integrity**: Verify constraints, cascading behavior, unique rules
- **Refactoring**: Redesign relationships, consolidate tables, normalize data
- **Audit**: Review existing schema for improvements
- **Documentation**: Generate entity relationship diagrams (see `erd/`)

## Prerequisites

- `prisma/schema.prisma` file
- Understanding of Prisma data types and relations
- PostgreSQL knowledge (joins, indexes, constraints)
- Domain knowledge of what data needs to be stored
- Current application requirements (performance, scale, features)

## This Project's Conventions

Every existing model follows the same shape — match it for new entities:

- **`Int @id @default(autoincrement())` primary keys, not UUID.** This is a hard project convention (see every model in `prisma/schema.prisma`); don't introduce UUID ids for a new entity unless there's a specific reason (e.g. an externally-facing token).
- **No soft deletes anywhere.** There is no `deletedAt` field in the schema. Deletes are real `prisma.<model>.delete()` calls, and services handle the "still referenced elsewhere" case by catching Prisma error code `P2025` rather than filtering `deletedAt: null`. Only add a `deletedAt` column if a feature has an explicit audit/undo requirement — it would be a deliberate deviation from the rest of the schema, not the default.
- **Audit columns on every mutable model**: `createdAt DateTime @default(now())`, `createdBy Int`, `updatedAt DateTime @updatedAt`, `updatedBy Int`. `createdBy`/`updatedBy` are plain `Int` user ids (no `@relation` back to `User` in most models — they're informational, not enforced FKs). Follow this rather than adding a `creator User @relation(...)` unless the feature genuinely needs to join back to `User`.
- **`@@map("snake_case_table_name")`** on every model — table names are snake_case plural, model names are PascalCase singular.
- **Templates vs. generated instances**: the shift/task domain models this as reusable `*Template` rows (owned by `Branch`) that generate dated `*` instance rows (`MasterShiftTemplate` → `MasterShift`, etc.), with the instance holding a nullable FK back to the template it came from (`onDelete: SetNull`) so history survives template edits/deletion. Reuse this pattern for any new "recurring definition vs. dated occurrence" entity instead of inventing a new shape.

## Core Workflow

### Phase 1: Understand Current State

1. Read `prisma/schema.prisma` completely
2. Identify all models and their relationships
3. List current indexes and unique constraints
4. Find any legacy or deprecated fields (e.g. the commented-out `UserBranch` model — superseded by `EmployeeBranch`)
5. Understand how models are queried (look at service files)
6. Identify performance bottlenecks or N+1 patterns

### Phase 2: Design New Entities

**Follow this checklist for each new entity**, matching the project convention:

```prisma
// Example: New "Department" entity
model Department {
  // 1. Primary key — Int autoincrement, matching every other model
  id           Int     @id @default(autoincrement())

  // 2. Core fields (business logic fields)
  name         String
  description  String?
  code         String  @unique                    // Index for lookups
  budgetAmount Decimal @db.Decimal(15, 2)          // Currency precision

  // 3. Relationships (foreign keys)
  branchId     Int
  branch       Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  // 4. Audit fields (required in this project — every mutable model has these)
  createdAt DateTime @default(now())
  createdBy Int
  updatedAt DateTime @updatedAt
  updatedBy Int

  // 5. Indexes (for query performance)
  @@index([branchId])                              // FK index
  @@unique([branchId, code])                        // Unique per branch

  @@map("departments")
}
```

**Key design principles:**

| Principle                          | Example                               | Why                                                              |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| **`Int` autoincrement ids**         | `id Int @id @default(autoincrement())` | Project-wide convention — every existing model does this          |
| **Required FK for ownership**       | `branchId Int` (no `?`)                | Ensures data integrity, prevents orphan records                   |
| **No soft deletes by default**      | Real `.delete()`, no `deletedAt`       | Matches every existing model; only deviate with explicit justification |
| **Audit fields**                    | `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | Tracks who/when, matches every existing model                     |
| **Index foreign keys**              | `@@index([branchId])`                  | Speeds up JOIN queries, prevents sequential scans                 |
| **Unique constraints**              | `@@unique([branchId, code])`           | Prevents duplicates, enables efficient lookups                     |
| **Composite keys for join tables**  | `@@id([employeeId, branchId])`         | Prevents duplicate relationships, optimizes queries (see `EmployeeBranch`) |
| **Correct relations**               | `@relation(onDelete: Cascade)`         | Data integrity, prevents FK constraint violations                 |
| **`@@map(...)` snake_case table**   | `@@map("departments")`                 | Matches every existing model's DB naming                           |

### Phase 3: Validate Relationships

**One-to-Many (most common):**

```prisma
model Branch {
  id          Int          @id @default(autoincrement())
  name        String
  departments Department[]
}

model Department {
  id       Int    @id @default(autoincrement())
  name     String
  branchId Int
  branch   Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId])
}
```

**Many-to-Many (explicit join table with composite PK — see `EmployeeBranch`, `RolePermission`):**

```prisma
model Employee {
  id               Int              @id @default(autoincrement())
  employeeBranches EmployeeBranch[]
}

model Branch {
  id               Int              @id @default(autoincrement())
  employeeBranches EmployeeBranch[]
}

model EmployeeBranch {
  employeeId Int
  branchId   Int
  isPrimary  Boolean  @default(false)
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  branch     Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@id([employeeId, branchId])
  @@map("employee_branches")
}
```

**One-to-One (see `User` ↔ `ZaloIdentity`, `Employee` ↔ `User`):**

```prisma
model Employee {
  id     Int   @id @default(autoincrement())
  userId Int?  @unique // nullable — an Employee can exist before being linked to a login User
  user   User? @relation(fields: [userId], references: [id])
}

model User {
  id       Int       @id @default(autoincrement())
  employee Employee? // back-relation, optional
}
```

**Self-referencing (hierarchies) — not currently used in this schema, but if needed:**

```prisma
model Employee {
  id        Int        @id @default(autoincrement())
  managerId Int?
  manager   Employee?  @relation("ManagerReports", fields: [managerId], references: [id], onDelete: SetNull)
  reports   Employee[] @relation("ManagerReports")

  @@index([managerId])
}
```

**Template → generated instance (see `MasterShiftTemplate` → `MasterShift`):**

```prisma
model MasterShiftTemplate {
  id       Int           @id @default(autoincrement())
  branchId Int
  branch   Branch        @relation(fields: [branchId], references: [id], onDelete: Cascade)

  masterShifts MasterShift[]
}

model MasterShift {
  id                    Int                  @id @default(autoincrement())
  branchId              Int
  masterShiftTemplateId Int?                 // nullable: instance survives template deletion
  branch                Branch               @relation(fields: [branchId], references: [id], onDelete: Cascade)
  masterShiftTemplate   MasterShiftTemplate? @relation(fields: [masterShiftTemplateId], references: [id], onDelete: SetNull)
  workDate              DateTime             @db.Date
}
```

**Validation checklist for relations:**

- ✅ Foreign key field is `Int` (matching the referenced model's `Int` id)
- ✅ `@relation()` specifies `fields` (FK column) and `references` (target column)
- ✅ `onDelete` strategy is appropriate:
  - `Cascade`: delete children when parent deleted (e.g. branch → its templates)
  - `SetNull`: set FK to null when parent deleted (nullable FK only — e.g. instance ↔ template)
  - `Restrict`: prevent deletion if children exist
- ✅ Index added on foreign key for performance
- ✅ Many-to-many has explicit join table with composite key
- ✅ No circular dependencies without an explicit `name` in `@relation()`

### Phase 4: Design Indexes

```prisma
model TimeLog {
  id           Int           @id @default(autoincrement())
  assignmentId Int
  employeeId   Int
  status       TimeLogStatus
  createdAt    DateTime      @default(now())

  assignment   Assignment    @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  employee     Employee      @relation(fields: [employeeId], references: [id])

  @@index([assignmentId])   // Query by assignment
  @@map("time_logs")
}
```

**Index strategy:**

| Pattern              | Index                             | Cost   | Benefit                              |
| -------------------- | ---------------------------------- | ------ | ------------------------------------- |
| Filter by FK         | `@@index([employeeId])`            | Small  | Required for most queries              |
| Filter by enum       | `@@index([status])`                | Medium | Useful for status-based queries        |
| Range queries        | `@@index([createdAt])`             | Medium | Essential for date range queries       |
| Multi-column filters | `@@index([employeeId, status])`    | Larger | Optimizes common combinations          |
| Unique constraint    | `@@unique([employeeId, subShiftId])` | Small | Prevents duplicates, enables lookups (see `Availability`, `Assignment`) |

**Avoid over-indexing:**

- Too many indexes slow down INSERT/UPDATE (must maintain all indexes)
- Target indexes to actual query patterns
- Use composite indexes for frequently combined filters
- Measure actual query performance before adding an index

### Phase 5: Design Constraints

```prisma
model Employee {
  id          Int       @id @default(autoincrement())
  phoneNumber String    @unique          // No duplicate phone numbers
  hireDate    DateTime?
  branchId    Int?                       // Nullable if not yet assigned

  createdAt DateTime @default(now())
  createdBy Int
  updatedAt DateTime @updatedAt
  updatedBy Int
}
```

**Constraint types:**

| Constraint         | SQL                | Purpose                  | Example                               |
| ------------------ | ------------------- | -------------------------- | ---------------------------------------- |
| `@unique`          | UNIQUE               | Single column uniqueness   | `phoneNumber @unique`                     |
| `@@unique([a, b])` | UNIQUE(a, b)         | Composite uniqueness       | `@@unique([branchId, name])`              |
| `@id`              | PRIMARY KEY          | Entity identity            | `id @id @default(autoincrement())`        |
| `@@id([a, b])`     | PRIMARY KEY(a, b)    | Composite identity         | Join table PKs (`EmployeeBranch`, `RolePermission`) |
| Nullable (`?`)     | allows NULL          | Optional relation/field    | `managerId Int?`                          |
| Required (no `?`)  | NOT NULL             | Disallow nulls             | `phoneNumber String`                      |
| `@db.Decimal(p,s)` | NUMERIC(p,s)         | Currency/precision         | `rate Decimal @db.Decimal(10, 2)`          |
| `@db.Time`/`@db.Date` | TIME/DATE          | Time-of-day / date-only    | Shift template `startTime`/`endTime`      |
| Default values     | DEFAULT              | Fallback value              | `@default(now())`, `status @default(ACTIVE)` |
| Foreign keys       | FOREIGN KEY          | Referential integrity      | `@relation(onDelete: Cascade)`             |

### Phase 6: Detect Query Patterns

```typescript
// Service: employee.service.ts
async findByBranch(branchId: number) {
  // Query: WHERE branchId = ? via the EmployeeBranch join table
  // Index needed: @@index([branchId]) on EmployeeBranch (already present)
  return this.prisma.employeeBranch.findMany({
    where: { branchId },
    include: { employee: true },
  });
}
```

**Common N+1 patterns to avoid** (see `employee.service.ts`'s `.include()` usage for the correct pattern already used in this codebase):

```typescript
// BAD: N+1 query (1 query for employees + N queries for branches)
const employees = await this.prisma.employee.findMany();
for (const emp of employees) {
  await this.prisma.employeeBranch.findMany({ where: { employeeId: emp.id } });
}

// GOOD: Use include to fetch relations in a single query
const employees = await this.prisma.employee.findMany({
  include: { employeeBranches: { include: { branch: true } } },
});
```

### Phase 7: Review for Data Integrity

```prisma
model Branch {
  id                   Int                   @id @default(autoincrement())
  masterShiftTemplates MasterShiftTemplate[]
}

model MasterShiftTemplate {
  id       Int    @id @default(autoincrement())
  branchId Int
  branch   Branch @relation(fields: [branchId], references: [id], onDelete: Cascade) // Deleting a branch deletes its templates

  masterShifts MasterShift[]
}

model MasterShift {
  id                    Int                  @id @default(autoincrement())
  masterShiftTemplateId Int?
  masterShiftTemplate   MasterShiftTemplate? @relation(fields: [masterShiftTemplateId], references: [id], onDelete: SetNull) // Generated shifts survive template deletion
}
```

Note the deliberate asymmetry already in the schema: deleting a `Branch` cascades hard through its templates (`onDelete: Cascade`), but deleting a template only detaches already-generated `MasterShift`/`SubShift`/`Task` rows (`onDelete: SetNull`) rather than deleting shift history. Follow this pattern — history-bearing rows should outlive the template that generated them.

### Phase 8: Validate Migration Safety

**Before creating a migration, check:**

1. **Schema syntax**: valid Prisma syntax, all relations valid
2. **Index names**: no conflicts with existing indexes
3. **Cascading**: verify `onDelete` behavior is safe
4. **Nullable changes**: adding `NOT NULL` requires a default or a two-step migration
5. **Data size**: large tables with migrations might be slow
6. **Backward compatibility**: can old code still work during deployment?

```prisma
// UNSAFE: Adding required field without default
model Task {
  priority Int  // ERROR: existing records have no value!
}

// SAFE: Add optional first, backfill, then make required in a follow-up migration
model Task {
  priority Int? // Step 1
  // Step 2 (data migration): UPDATE tasks SET priority = 0 WHERE priority IS NULL;
  // Step 3 (follow-up schema change): priority Int @default(0)
}
```

### Phase 9: Create Migration

```bash
# Create migration from schema changes
pnpm db:dev --name "add_department_entity"

# Verify migration file is safe
cat prisma/migrations/<timestamp>_add_department_entity/migration.sql

# Test migration end-to-end
pnpm db:reset

# Verify schema in database
pnpm prisma db pull
```

## Schema Review Checklist

### Structure

- ✅ All entities have `Int @id @default(autoincrement())` primary keys
- ✅ All mutable entities have audit fields (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`)
- ✅ Required foreign keys have no `?` (null not allowed)
- ✅ Optional relations have `?` for nullable FK
- ✅ `@@map("snake_case_name")` set on every model

### Relationships

- ✅ One-to-many: parent model has no FK, child model has FK
- ✅ Many-to-many: explicit join table with composite PK
- ✅ One-to-one: one side has `@unique` on FK
- ✅ All FKs have `@relation()` with `fields` and `references`
- ✅ `onDelete` strategy is appropriate (`Cascade`/`SetNull`/`Restrict`) — history-bearing rows should survive template/definition deletion via `SetNull`, not cascade away
- ✅ No circular dependencies without explicit `name`

### Indexes

- ✅ All foreign keys have `@@index()` (or are covered by a `@@unique`)
- ✅ Common filter columns have `@@index()`
- ✅ Composite indexes for frequently combined filters
- ✅ No over-indexing (each index has a clear use case)

### Constraints

- ✅ Natural keys (phone number, code, etc.) have `@unique`
- ✅ Composite uniqueness constraints where needed
- ✅ Required fields don't have `?`
- ✅ Decimal/currency fields use `@db.Decimal(precision, scale)`

### Data Integrity

- ✅ Cascading behavior won't cause unexpected data loss
- ✅ No `deletedAt`/soft-delete field added without an explicit reason (deviates from every other model)
- ✅ No orphan records possible (required FKs or `Cascade`)
- ✅ Backward compatible with existing data

### Query Performance

- ✅ N+1 patterns identified and documented
- ✅ Common query patterns have supporting indexes
- ✅ Composite indexes match actual filter patterns

## Common Schema Issues & Fixes

| Issue                    | Cause                                  | Fix                                                  |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| N+1 queries              | Missing `.include()`                     | Review service files, add indexes for FK columns          |
| FK constraint violation  | Parent deleted, children orphaned        | Use `onDelete: Cascade` or `SetNull` as appropriate       |
| Slow searches            | No index on filter columns               | Add `@@index([columnName])` for common filters            |
| Duplicate records        | Missing `@unique` constraint             | Add `@unique` or `@@unique([col1, col2])`                 |
| Performance regression   | Too many indexes on a write-heavy table  | Profile queries, remove unused indexes                     |
| Accidentally adding a UUID id or `deletedAt` | Copying a generic Prisma tutorial pattern instead of this project's convention | Use `Int @id @default(autoincrement())` and real deletes, matching every existing model |
| Circular foreign keys    | Relations not named                      | Use `@relation(name: "...")` to distinguish                |

## Key Principles

1. **Design for queries**: index columns that are filtered, not columns that are selected
2. **Match existing conventions**: `Int` autoincrement ids, no soft deletes, `createdBy`/`updatedBy` audit columns, `@@map()` snake_case tables — deviating from these should be a deliberate, justified choice, not a default
3. **Required by default**: make FKs required to prevent orphan records
4. **Cascade carefully**: verify that cascading doesn't delete important history (prefer `SetNull` for template/definition → generated-instance relations)
5. **Composite keys**: use for many-to-many joins to prevent duplicates
6. **Backward compatible**: design migrations that work with rolling deployments

## Quick Reference Commands

```bash
# Review schema syntax
pnpm prisma validate

# See current schema state
pnpm prisma db pull

# Generate migration
pnpm db:dev --name "description"

# Reset database and reapply all migrations
pnpm db:reset

# View schema in visual format
pnpm prisma studio

# Check for schema drift
pnpm prisma migrate diff
```

## See Also

- [AGENTS.md](../../../../AGENTS.md) — Project overview, domain model, auth/authorization
- [database-lifecycle SKILL](../database-lifecycle/SKILL.md) — Migration workflow, seed validation
- [prisma/schema.prisma](../../../../prisma/schema.prisma) — Current schema definition
- [erd/](../../../../erd/) — Entity relationship diagrams
- [Prisma Docs](https://www.prisma.io/docs) — Official Prisma schema documentation
