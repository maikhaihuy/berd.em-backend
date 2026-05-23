---
name: database-lifecycle
description: 'Manage Prisma database lifecycle: schema design, migrations, seed scripts, query optimization. Use for reviewing/fixing seeds, diagnosing migration issues, detecting N+1 queries, ensuring idempotency, and troubleshooting schema drift.'
argument-hint: 'Ask "Review my seed script for issues" or "Diagnose this migration problem"'
---

# Database Lifecycle Management

Comprehensive workflow for designing, validating, and optimizing Prisma schemas, migrations, seeds, and database queries in NestJS applications.

## When to Use

- **Schema review**: Design or audit schema structure, relationships, indexes
- **Migration issues**: Diagnose rollback failures, conflicts, or drift
- **Seed validation**: Review seed scripts for idempotency, dependency order, error handling
- **Query optimization**: Detect N+1 patterns, missing includes, suboptimal relationships
- **Data integrity**: Verify constraints, cascading behavior, referential integrity
- **Seeding problems**: Fix data duplication, FK constraint violations, timing issues

## Prerequisites

- Prisma schema file (`prisma/schema.prisma`)
- Migration history (`prisma/migrations/`)
- Seed script (`prisma/seed.ts`)
- NestJS service files using Prisma client
- PostgreSQL connection (development database)

## Core Workflow

### Phase 1: Assess & Diagnose (Discovery)

**Goal**: Identify the specific database lifecycle problem.

1. Review the error message or symptom (migration failure, seed crash, slow query)
2. Gather relevant files:
   - `prisma/schema.prisma` (current schema state)
   - `prisma/migrations/` (migration history, especially recent)
   - `prisma/seed.ts` or affected service file
   - Relevant module DTOs and service methods
3. Check for common root causes:
   - **Migrations**: Rollback conflicts, missing `.sql` files, schema drift, unsupported operations
   - **Seeds**: Circular dependencies, missing relations, duplicate IDs, FK constraint violations
   - **Queries**: Eager loading depth (N+1), missing indexes, OR conditions, full table scans
   - **Schema**: Conflicting unique constraints, missing cascadeOnDelete, incorrect relations

### Phase 2: Validate Structure (Analysis)

**Goal**: Ensure schema and migration coherence.

1. **Schema validation**:
   - Check `@@unique`, `@@index` for performance hotspots
   - Verify `@db.` annotations match PostgreSQL types
   - Review relation definitions: `@relation(name: "...")` consistency
   - Confirm cascadeOnDelete or explicit cleanup logic
   - Look for cyclic dependencies in relationships (see [Migration Best Practices](./references/migration-best-practices.md#issue-circular-foreign-key-dependencies))

2. **Migration validation**:
   - Confirm migrations apply in order without conflicts
   - Check for manual SQL that conflicts with schema state
   - Verify rollback safety (can reverse operations be run?)
   - Review column changes: NOT NULL additions require defaults or backfill (see [Migration Best Practices](./references/migration-best-practices.md))

3. **Seed validation** (see [Seed Validation Checklist](./references/seed-validation-checklist.md)):
   - Verify creation order (parents before children)
   - Check idempotency: using `upsert` or `skipDuplicates` where appropriate
   - Confirm FK connections exist at insert time
   - Review error handling: will partial failures be caught?

4. **Query validation** (see [Query Optimization Patterns](./references/query-optimization-patterns.md)):
   - Scan service methods for `findMany` + nested loops (N+1 risk)
   - Check for missing `.include()` or `.select()` statements
   - Review pagination logic: is `take`/`skip` used correctly?
   - Look for `$queryRaw` or `$queryRawUnsafe`: are they parameterized?

### Phase 3: Recommend Fixes

**Goal**: Provide specific, actionable changes.

Based on diagnosis, recommend one or more of:

- **Schema changes**: Adjust relations, add indexes, fix constraints
- **New migration**: Create a migration file to fix schema drift
- **Seed refactor**: Add dependency ordering, improve error handling, ensure idempotency
- **Query optimization**: Add includes, convert loops to batch queries, create indexes
- **Database reset**: If drift is severe, `prisma migrate reset` to synchronize

### Phase 4: Implement & Test

**Goal**: Apply fixes and verify correctness.

1. **For schema changes**:
   ```bash
   pnpm prisma migrate dev --name "<description>"
   ```
   - Confirm migration file is created
   - Verify development database updates
   - Check that no data is lost unexpectedly

2. **For seed fixes**:
   ```bash
   pnpm prisma db seed
   ```
   - Run multiple times to verify idempotency
   - Check seed output for errors
   - Inspect database state: `pnpm prisma studio`

3. **For query optimizations**:
   - Run integration tests: `pnpm test:e2e`
   - Profile query execution (check logs for N+1)
   - Compare performance before/after with timing

4. **For migration conflicts**:
   ```bash
   pnpm prisma migrate resolve --applied <name>
   # or reset if necessary
   pnpm prisma migrate reset --force
   ```

## Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| Seed script fails with FK constraint error | Parent record not created yet | See [Seed Validation Checklist](./references/seed-validation-checklist.md) for dependency ordering |
| Seed runs twice, creates duplicates | Non-idempotent create logic | Use `upsert` or check `skipDuplicates` on `createMany` |
| Migration fails on `ALTER COLUMN ... SET NOT NULL` | Existing NULL values in column | See [Migration Best Practices](./references/migration-best-practices.md) for safe migrations |
| N+1 query in API response | Missing `.include()` in findMany | See [Query Optimization Patterns](./references/query-optimization-patterns.md) for include strategies |
| `prisma migrate status` shows drift | Manual schema changes in database | See [Migration Best Practices](./references/migration-best-practices.md) for drift resolution |
| Circular relation errors | Bidirectional `@relation` missing name | See [Migration Best Practices](./references/migration-best-practices.md) for circular FK solutions |

## Key Principles

1. **Idempotency**: Seed scripts and migrations should be safe to run multiple times
2. **Order matters**: Seed parents before children; apply migrations in sequence
3. **Cascading behavior**: Explicit `cascadeOnDelete` or explicit cleanup prevents data orphans
4. **Query efficiency**: Load related data upfront (`.include`) instead of in loops (N+1)
5. **Schema drift**: Keep database and migrations in sync; use `prisma migrate reset` if mismatch occurs
6. **Testing**: Run seeds multiple times; check `prisma studio` for correctness; test migrations on a copy first

## Quick Reference Commands

```bash
# View current schema state
pnpm prisma db pull

# Generate migration from schema changes
pnpm prisma migrate dev --name "description"

# Run seed script
pnpm prisma db seed

# Open visual database explorer
pnpm prisma studio

# Check migration status
pnpm prisma migrate status

# Reset development database (careful!)
pnpm prisma migrate reset --force

# Resolve migration conflicts
pnpm prisma migrate resolve --applied <migration_name>
```

## References

- [Prisma Migration Documentation](https://www.prisma.io/docs/orm/prisma-migrate/overview)
- [Prisma Seed Documentation](https://www.prisma.io/docs/guides/database/seed-database)
- [Prisma Schema Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/)
- [NestJS Prisma Integration](https://docs.nestjs.com/recipes/prisma)
