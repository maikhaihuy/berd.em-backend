---
name: schema-review
description: 'Review, validate, and design database schemas: relationships, indexes, constraints, migrations. Use when: auditing schema structure, proposing new entities, reviewing schema changes, optimizing indexes, detecting N+1 patterns, preventing data integrity issues.'
argument-hint: 'Ask "Review this schema change for issues" or "Audit the database schema for optimization"'
---

# Schema Design & Review Guide

Comprehensive patterns for designing, validating, and optimizing Prisma schemas in PostgreSQL.

## When to Use

- **New entities**: Design relationships, constraints, and indexes upfront
- **Schema changes**: Validate proposed changes before migration
- **Performance**: Detect missing indexes, N+1 query patterns
- **Data integrity**: Verify constraints, cascading behavior, unique rules
- **Refactoring**: Redesign relationships, consolidate tables, normalize data
- **Audit**: Review existing schema for improvements
- **Documentation**: Generate entity relationship diagrams

## Prerequisites

- `prisma/schema.prisma` file
- Understanding of Prisma data types and relations
- PostgreSQL knowledge (joins, indexes, constraints)
- Domain knowledge of what data needs to be stored
- Current application requirements (performance, scale, features)

## Core Workflow

### Phase 1: Understand Current State

**Gather schema context:**

1. Read `prisma/schema.prisma` completely
2. Identify all models and their relationships
3. List current indexes and unique constraints
4. Find any legacy or deprecated fields
5. Understand how models are queried (look at service files)
6. Identify performance bottlenecks or N+1 patterns

### Phase 2: Design New Entities

**Follow this checklist for each new entity:**

```typescript
// Example: New "Department" entity
model Department {
  // 1. Primary key (always id as UUID)
  id            String    @id @default(uuid())

  // 2. Core fields (business logic fields)
  name          String    @db.VarChar(100)
  description   String?   @db.Text
  code          String    @unique                    // Index for lookups
  budgetAmount  Decimal   @db.Decimal(15, 2)       // Currency precision

  // 3. Relationships (foreign keys)
  companyId     String                              // Required FK
  company       Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // 4. Audit fields (required in BERD.EM)
  createdAt     DateTime  @default(now())           // Created timestamp
  createdBy     String                              // FK to User
  creator       User      @relation(fields: [createdBy], references: [id])
  updatedAt     DateTime  @updatedAt                // Updated timestamp (auto)
  deletedAt     DateTime?                           // Soft delete timestamp

  // 5. Indexes (for query performance)
  @@index([companyId])                              // FK index
  @@index([code])                                   // Lookup index
  @@fulltext([name, description])                   // Full-text search

  // 6. Composite constraints (business rules)
  @@unique([companyId, code])                       // Unique per company
}
```

**Key design principles:**

| Principle | Example | Why |
|-----------|---------|-----|
| **Always use UUID for IDs** | `id String @id @default(uuid())` | Database-agnostic, globally unique, auto-generated |
| **Required FK for ownership** | `companyId String` (no `?`) | Ensures data integrity, prevents orphan records |
| **Soft deletes** | `deletedAt DateTime?` | Maintains audit trail, supports recovery, no permanent data loss |
| **Audit fields** | `createdAt`, `createdBy`, `updatedAt` | Tracks who/when, supports compliance, debugging |
| **Index foreign keys** | `@@index([companyId])` | Speeds up JOIN queries, prevents sequential scans |
| **Unique constraints** | `@@unique([companyId, code])` | Prevents duplicates, enables efficient lookups |
| **Composite keys for join tables** | `@@id([userId, branchId])` | Prevents duplicate relationships, optimizes queries |
| **Correct relations** | `@relation(onDelete: Cascade)` | Data integrity, prevents FK constraint violations |

### Phase 3: Validate Relationships

**Check relation definitions:**

**One-to-Many (most common):**

```typescript
model Company {
  id          String        @id @default(uuid())
  name        String
  // One company has many departments
  departments Department[]
}

model Department {
  id        String   @id @default(uuid())
  name      String
  companyId String   // Foreign key
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId]) // Index FK for queries
}
```

**Many-to-Many (explicit join table):**

```typescript
model User {
  id       String    @id @default(uuid())
  email    String    @unique
  branches UserBranch[]
}

model Branch {
  id    String     @id @default(uuid())
  name  String
  users UserBranch[]
}

// Explicit join table with metadata
model UserBranch {
  userId            String
  branchId          String
  isPrimaryBranch   Boolean @default(false)
  assignedAt        DateTime @default(now())
  
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch            Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@id([userId, branchId]) // Composite primary key
  @@index([userId])        // For lookups by user
}
```

**One-to-One (less common, validate carefully):**

```typescript
model Employee {
  id             String   @id @default(uuid())
  userId         String   @unique // Ensures one-to-one
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Each employee has exactly one user
}

model User {
  id       String    @id @default(uuid())
  email    String    @unique
  employee Employee? // Optional because might not be an employee
}
```

**Self-referencing (hierarchies):**

```typescript
model Employee {
  id          String       @id @default(uuid())
  name        String
  
  // Reports to manager (nullable: CEO has no manager)
  managerId   String?
  manager     Employee?    @relation("ManagerReports", fields: [managerId], references: [id], onDelete: SetNull)
  
  // Employees reporting to this employee
  reports     Employee[]   @relation("ManagerReports")

  @@index([managerId])
}
```

**Validation checklist for relations:**

- ✅ Foreign key field has correct type (usually String for UUID)
- ✅ `@relation()` specifies `fields` (FK column) and `references` (target column)
- ✅ `onDelete` strategy is appropriate:
  - `Cascade`: Delete children when parent deleted (e.g., department → employees)
  - `SetNull`: Set FK to null when parent deleted (nullable FK only, e.g., manager)
  - `Restrict`: Prevent deletion if children exist (strict: e.g., cannot delete company with departments)
- ✅ Index added on foreign key for performance
- ✅ Many-to-many has explicit join table with composite key
- ✅ No circular dependencies without explicit `name` in `@relation()`

### Phase 4: Design Indexes

**Index design for query performance:**

```typescript
model TimeLog {
  id              String   @id @default(uuid())
  employeeId      String
  workSlotId      String?
  clockInTime     DateTime
  clockOutTime    DateTime?
  status          TimeLogStatus
  createdAt       DateTime @default(now())

  employee        Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  workSlot        WorkSlot? @relation(fields: [workSlotId], references: [id], onDelete: SetNull)

  // Single-column indexes (for WHERE clauses)
  @@index([employeeId])                     // Query by employee
  @@index([workSlotId])                     // Query by work slot
  @@index([status])                         // Query by status
  @@index([createdAt])                      // Query by date range

  // Composite indexes (for multiple columns in WHERE)
  @@index([employeeId, createdAt])          // Query: find logs for employee on date
  @@index([status, createdAt])              // Query: find pending logs from last 7 days

  // Unique constraints
  @@unique([workSlotId, clockInTime])       // Prevent duplicate clock-in for same slot
}
```

**Index strategy:**

| Pattern | Index | Cost | Benefit |
|---------|-------|------|---------|
| Filter by FK | `@@index([employeeId])` | Small | Required for most queries |
| Filter by enum | `@@index([status])` | Medium | Useful for status-based queries |
| Range queries | `@@index([createdAt])` | Medium | Essential for date range queries |
| Multi-column filters | `@@index([employeeId, status])` | Larger | Optimizes common combinations |
| Full-text search | `@@fulltext([name, description])` | Large | Enables text search |
| Unique constraint | `@@unique([email])` | Small | Prevents duplicates, enables lookups |

**Avoid over-indexing:**
- Too many indexes slow down INSERT/UPDATE (must maintain all indexes)
- Target indexes to actual query patterns
- Use composite indexes for frequently combined filters
- Measure actual query performance before adding index

### Phase 5: Design Constraints

**Prevent invalid data at database level:**

```typescript
model Employee {
  id              String   @id @default(uuid())
  email           String   @unique           // No duplicate emails
  firstName       String   @db.VarChar(100)  // Limit length
  hireDate        DateTime
  departmentId    String   // Required (no null)
  branchId        String   // Required (no null)

  department      Department @relation(fields: [departmentId], references: [id])
  branch          Branch     @relation(fields: [branchId], references: [id])

  // Composite unique: email unique per branch
  @@unique([branchId, email])

  // Composite index for lookups
  @@index([departmentId, branchId])

  // Custom constraint (documented)
  // Note: hireDate must be in the past or today
}
```

**Constraint types:**

| Constraint | SQL | Purpose | Example |
|-----------|-----|---------|---------|
| `@unique` | UNIQUE | Single column uniqueness | `email @unique` |
| `@@unique([a, b])` | UNIQUE(a, b) | Composite uniqueness | `@@unique([branchId, code])` |
| `@id` | PRIMARY KEY | Entity identity | `id @id @default(uuid())` |
| `@@id([a, b])` | PRIMARY KEY(a, b) | Composite identity | Join table PKs |
| Nullable (`?`) | NOT NULL violation | Allow nulls | `managerId String?` |
| Required (no `?`) | NOT NULL | Disallow nulls | `email String` |
| `@db.VarChar(n)` | VARCHAR(n) | Length limit | Names, codes |
| Default values | DEFAULT | Fallback value | `@default(uuid())`, `@default(now())` |
| Foreign keys | FOREIGN KEY | Referential integrity | `@relation(onDelete: Cascade)` |

### Phase 6: Detect Query Patterns

**Understand how models are queried to design indexes:**

```typescript
// Service: employee.service.ts
async findByBranch(branchId: string) {
  // Query: WHERE branchId = ? ORDER BY hireDate DESC
  // Index needed: @@index([branchId, hireDate])
  return this.prisma.employee.findMany({
    where: { branchId },
    orderBy: { hireDate: 'desc' },
  });
}

async findActiveInDepartment(deptId: string, date: Date) {
  // Query: WHERE departmentId = ? AND hireDate <= ? AND (deletedAt IS NULL)
  // Index needed: @@index([departmentId, hireDate])
  return this.prisma.employee.findMany({
    where: {
      departmentId: deptId,
      hireDate: { lte: date },
      deletedAt: null,
    },
  });
}

async findByEmailWithBranch(email: string) {
  // Query: WHERE email = ? (unique, so no index needed, covered by @@unique)
  // But will also load branch, so make sure it's included
  return this.prisma.employee.findUnique({
    where: { email },
    include: { branch: true },
  });
}
```

**Common N+1 patterns to avoid:**

```typescript
// BAD: N+1 query (1 query for employees + N queries for branches)
const employees = await this.prisma.employee.findMany();
for (const emp of employees) {
  const branch = await this.prisma.branch.findUnique({
    where: { id: emp.branchId },
  });
}

// GOOD: Use include to fetch relations in single query
const employees = await this.prisma.employee.findMany({
  include: { branch: true }, // Fetches branch in same query
});

// GOOD: Use select to fetch only needed fields
const employees = await this.prisma.employee.findMany({
  select: {
    id: true,
    email: true,
    branch: { select: { name: true } },
  },
});
```

### Phase 7: Review for Data Integrity

**Validate constraints and cascading:**

```typescript
model Company {
  id          String      @id @default(uuid())
  name        String      @unique
  departments Department[]
}

model Department {
  id        String       @id @default(uuid())
  name      String
  companyId String       // REQUIRED (no null, so no orphan departments)
  company   Company      @relation(
    fields: [companyId],
    references: [id],
    onDelete: Cascade    // If company deleted, delete all departments
  )
  employees Employee[]
}

model Employee {
  id           String     @id @default(uuid())
  email        String     @unique
  departmentId String
  department   Department @relation(
    fields: [departmentId],
    references: [id],
    onDelete: Cascade     // If department deleted, delete all employees
  )
}

// ISSUE: Deleting company cascades to departments, then to employees
// This might lose important data!
// FIX: Change to onDelete: Restrict to prevent accidental deletion
// OR: Implement soft delete before hard delete
```

### Phase 8: Validate Migration Safety

**Before creating migration, check:**

1. **Schema syntax**: Valid Prisma syntax, all relations valid
2. **Index names**: No conflicts with existing indexes
3. **Cascading**: Verify onDelete behavior is safe
4. **Nullable changes**: Adding NOT NULL requires default or migration strategy
5. **Data size**: Large tables with migrations might be slow
6. **Backward compatibility**: Can old code still work during deployment?

```typescript
// UNSAFE: Adding required field without default
model Task {
  // ... existing fields
  priority    Int  // ERROR: Existing records have no value!
}

// SAFE: Add optional first, then populate, then make required
model Task {
  // Step 1: Add optional
  priority    Int?  // Optional first

  // Step 2: Migrate data
  // UPDATE task SET priority = 1 WHERE priority IS NULL;

  // Step 3: Make required
  priority    Int  // Now required with default
  
  @@default(1)
}
```

### Phase 9: Create Migration

Once schema is validated:

```bash
# Create migration from schema changes
pnpm db:dev --name "add_department_entity"

# Verify migration file is safe
cat prisma/migrations/<timestamp>_add_department_entity/migration.sql

# Test migration
pnpm db:reset

# Verify schema in database
pnpm prisma db pull
```

## Schema Review Checklist

Use this checklist when reviewing a schema change:

### Structure
- ✅ All entities have UUID primary keys
- ✅ All entities have audit fields (createdAt, createdBy, updatedAt, deletedAt)
- ✅ Required foreign keys have no `?` (null not allowed)
- ✅ Optional relations have `?` for nullable FK
- ✅ Each model has appropriate comments

### Relationships
- ✅ One-to-many: Parent model has no FK, child model has FK
- ✅ Many-to-many: Explicit join table with composite PK
- ✅ One-to-one: One side has `@unique` on FK
- ✅ All FKs have `@relation()` with `fields` and `references`
- ✅ `onDelete` strategy is appropriate (Cascade/SetNull/Restrict)
- ✅ No circular dependencies without explicit `name`

### Indexes
- ✅ All foreign keys have `@@index()`
- ✅ Common filter columns have `@@index()`
- ✅ Composite indexes for frequently combined filters
- ✅ No over-indexing (each index has clear use case)
- ✅ Index names are descriptive (optional but recommended)

### Constraints
- ✅ Email/username/code have `@unique`
- ✅ Composite uniqueness constraints where needed
- ✅ Required fields don't have `?`
- ✅ Text fields have `@db.VarChar(n)` length limits
- ✅ Decimal/currency fields use `@db.Decimal(precision, scale)`

### Data Integrity
- ✅ Cascading behavior won't cause unexpected data loss
- ✅ Soft deletes (`deletedAt`) used for audit trails
- ✅ No orphan records possible (required FKs or CASCADE)
- ✅ Backward compatible with existing data

### Query Performance
- ✅ N+1 patterns identified and documented
- ✅ Common query patterns have supporting indexes
- ✅ Full-text search indexes for text-heavy queries
- ✅ Composite indexes match actual filter patterns

### Documentation
- ✅ Complex relationships explained in comments
- ✅ Enum values documented with examples
- ✅ Custom constraints documented
- ✅ Schema changes linked to implementation tickets

## Common Schema Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| N+1 queries | Missing `.include()` | Review service files, add indexes for FK columns |
| FK constraint violation | Parent deleted, children orphaned | Change `onDelete: Cascade` or add soft delete |
| Slow searches | No index on filter columns | Add `@@index([columnName])` for common filters |
| Duplicate records | Missing `@unique` constraint | Add `@unique` or `@@unique([col1, col2])` |
| Performance regression | Too many indexes on write-heavy table | Profile queries, remove unused indexes |
| Data loss on migration | Not using soft deletes | Add `deletedAt` field before hard delete operations |
| Circular foreign keys | Relations not named | Use `@relation(name: "...")` to distinguish |

## Key Principles

1. **Design for queries**: Index columns that are filtered, not columns that are selected
2. **Soft deletes**: Use `deletedAt` for auditability, not hard deletes
3. **Required by default**: Make FKs required to prevent orphan records
4. **Cascade carefully**: Verify that cascading doesn't delete important data
5. **Composite keys**: Use for many-to-many joins to prevent duplicates
6. **Comments**: Document why relationships/indexes exist
7. **Backward compatible**: Design migrations that work with rolling deployments

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
# (requires Prisma Studio or ERD tool)
pnpm prisma studio

# Check for schema drift
pnpm prisma migrate diff
```

## See Also

- [AGENTS.md](../../../../AGENTS.md) — Project overview, model patterns
- [database-lifecycle SKILL](.github/skills/database-lifecycle/SKILL.md) — Migration workflow, seed validation
- [prisma/schema.prisma](../../../../prisma/schema.prisma) — Current schema definition
- [Prisma Docs](https://www.prisma.io/docs) — Official Prisma schema documentation
- [PostgreSQL Docs](https://www.postgresql.org/docs/) — SQL constraints, indexes, data types
