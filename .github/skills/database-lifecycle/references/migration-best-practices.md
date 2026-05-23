# Migration Best Practices & Troubleshooting

Guide for managing Prisma migrations safely and resolving common migration issues.

## Safe Migration Workflow

### 1. Before Writing Migrations

- [ ] Pull latest schema changes: `pnpm prisma db pull`
- [ ] Ensure working directory is clean: `git status` shows no uncommitted changes
- [ ] Backup development database (or accept data loss if using `migrate reset`)
- [ ] Communicate changes to team (especially if production schema)

### 2. Making Schema Changes

Edit `prisma/schema.prisma` with your changes:

```prisma
// Good: Clear, incremental changes
model User {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  status    String  @default("ACTIVE") // NEW FIELD
  createdAt DateTime @default(now())
}
```

### 3. Generating Migration

```bash
pnpm prisma migrate dev --name "add_user_status_field"
```

This automatically:
- Detects schema changes
- Generates SQL migration
- Applies migration to dev database
- Regenerates Prisma Client

### 4. Review Generated Migration

Check `.prisma/migrations/<timestamp>_add_user_status_field/migration.sql`:

```sql
-- Review the SQL - ensure it's safe and correct
ALTER TABLE "User" ADD COLUMN "status" VARCHAR(255) NOT NULL DEFAULT 'ACTIVE';
```

- [ ] Is the SQL correct for your intent?
- [ ] Will it work on production (check column types, constraints)?
- [ ] Does it preserve existing data where needed?

### 5. Commit and Push

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "chore: add user status field"
git push
```

## Common Migration Issues & Fixes

### Issue: Adding NOT NULL Column Without Default

#### Error
```
Error: You are about to run migrations that may result in data loss.
```

#### Cause
Adding a `NOT NULL` column to a table with existing rows requires existing values.

#### Solution

**Option 1: Add Default Value**
```prisma
model User {
  status String @default("ACTIVE") // Provides default for new rows
}
```

**Option 2: Two-Step Migration** (For existing data)

Step 1: Add nullable column
```bash
pnpm prisma migrate dev --name "add_user_status_nullable"
# Manually add data: UPDATE users SET status = 'ACTIVE' WHERE status IS NULL
```

Step 2: Make NOT NULL
```prisma
model User {
  status String // Make NOT NULL in schema
}
pnpm prisma migrate dev --name "make_user_status_required"
```

### Issue: Rollback Failures

#### Error
```
Could not apply this migration. Error: ERROR: column "x" does not exist
```

#### Cause
Rolling back a migration that deleted data or made breaking changes.

#### Solution

1. **Identify the failing migration**: `pnpm prisma migrate status`
2. **Mark as resolved**: `pnpm prisma migrate resolve --applied <migration_name>`
3. **OR reset if on dev**: `pnpm prisma migrate reset --force`

### Issue: Schema Drift (Database & Schema Mismatch)

#### Error
```
The migrations have not yet been applied to the database
```

#### Cause
Database schema doesn't match migration history (manual SQL changes, skipped migrations, etc.)

#### Solution

**For Development**:
```bash
pnpm prisma migrate reset --force
# This:
# 1. Drops the database
# 2. Creates new database
# 3. Applies all migrations
# 4. Runs seed script
```

**For Production** (Careful!):
```bash
# 1. Backup database first
# 2. Check which migration is missing: pnpm prisma migrate status
# 3. Apply manually or use: pnpm prisma migrate deploy
```

### Issue: Circular Foreign Key Dependencies

#### Error
```
Error creating foreign key constraint
```

#### Cause
Two tables reference each other, but neither can be created first.

#### Solution

**Option 1: Remove one reference** (if logically possible)
```prisma
// Before: Circular
model User {
  id    Int
  posts Post[]
}

model Post {
  id     Int
  userId Int
  user   User @relation(fields: [userId])
}

// After: One-way relation
model User {
  id    Int
  posts Post[] // Back-relation, no FK
}

model Post {
  id     Int
  userId Int
  user   User @relation(fields: [userId])
}
```

**Option 2: Use Explicit Relation Names**
```prisma
model User {
  id      Int
  authored Post[] @relation("authored")
  liked    Post[] @relation("liked")
}

model Post {
  authorId Int
  author   User @relation("authored", fields: [authorId])
  likedBy  User[] @relation("liked")
}
```

### Issue: Renaming Fields/Tables Causes Data Loss

#### Error
Migration appears to work but data is lost.

#### Cause
Prisma generates `DROP COLUMN` + `ADD COLUMN` instead of `RENAME`.

#### Solution

Edit the migration `.sql` file manually:

```sql
-- GENERATED (loses data):
-- ALTER TABLE "User" DROP COLUMN "oldName";
-- ALTER TABLE "User" ADD COLUMN "newName" VARCHAR(255);

-- BETTER (preserves data):
ALTER TABLE "User" RENAME COLUMN "oldName" TO "newName";
```

Then apply:
```bash
pnpm prisma migrate deploy
```

### Issue: Changing Column Type Requires Coercion

#### Error
```
ERROR: column "x" cannot be cast automatically to type y
```

#### Cause
PostgreSQL can't implicitly convert existing data to the new type.

#### Example
```prisma
// Before: createdAt as String
// After:  createdAt as DateTime
```

#### Solution

Manual SQL migration in `.sql` file:

```sql
-- Step 1: Create new column with new type
ALTER TABLE "User" ADD COLUMN "createdAt_temp" TIMESTAMP;

-- Step 2: Convert existing data
UPDATE "User" SET "createdAt_temp" = to_timestamp("createdAt", 'YYYY-MM-DD HH24:MI:SS');

-- Step 3: Drop old column
ALTER TABLE "User" DROP COLUMN "createdAt";

-- Step 4: Rename new column
ALTER TABLE "User" RENAME COLUMN "createdAt_temp" TO "createdAt";
```

## Migration Testing Checklist

After generating a migration:

- [ ] Review generated SQL for correctness
- [ ] Test on development database: `pnpm prisma migrate dev`
- [ ] Run seed script: `pnpm prisma db seed`
- [ ] Verify data integrity: `pnpm prisma studio`
- [ ] Run integration tests: `pnpm test:e2e`
- [ ] Test rollback (if applicable): `pnpm prisma migrate resolve --rolled-back <name>`
- [ ] Commit and push with clear message

## Migration Naming Convention

Use clear, action-oriented names:

```
✓ add_user_email_field
✓ create_permission_table
✓ add_user_role_relationship
✓ rename_user_fullname_to_full_name
✗ migration1
✗ schema_updates
✗ fix_stuff
```

## Production Migration Strategy

### Before Running on Production

1. **Test on staging**: Apply migration to staging database first
2. **Review impact**: Check how many rows will be affected
3. **Plan downtime**: Estimate migration duration
4. **Prepare rollback**: Know how to rollback if something fails
5. **Notify team**: Inform relevant stakeholders

### Deployment

```bash
# 1. Tag release with migration
git tag v1.2.3

# 2. Deploy code
# 3. Apply migration
pnpm prisma migrate deploy

# 4. Verify
pnpm prisma migrate status # Should show "All migrations have been applied"
```

### Rollback Plan

```bash
# If migration fails, you have options:
# 1. Fix the code and re-apply
# 2. Manual SQL rollback + migration resolve
# 3. Restore from backup (worst case)

pnpm prisma migrate resolve --rolled-back <migration_name>
```

## References

- [Prisma Migration Guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/team-development)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Prisma Migration Troubleshooting](https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting)
