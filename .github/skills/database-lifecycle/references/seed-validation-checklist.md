# Seed Script Validation Checklist

Use this checklist when reviewing or writing Prisma seed scripts.

## Structure & Idempotency

- [ ] Script starts with `const prisma = new PrismaClient()`
- [ ] Script ends with `.finally(() => prisma.$disconnect())`
- [ ] All create operations use `upsert` OR `createMany` with `skipDuplicates: true`
- [ ] Script can run multiple times without duplicating data
- [ ] Script handles partial failures gracefully (try/catch or atomic operations)

## Dependency Ordering

- [ ] Parent entities are created before children (users → roles → permissions)
- [ ] FK relations in `create` blocks reference entities that exist
- [ ] Circular dependencies are broken with separate relation assignments
- [ ] Relations use `.connect()` for existing records, `.create()` for new ones

## Data Integrity

- [ ] All required fields are provided (no missing non-optional fields)
- [ ] Unique constraints are respected (no duplicate email, username, etc.)
- [ ] Default values align with schema (e.g., status: 'ACTIVE')
- [ ] Timestamps are set consistently (`createdAt`, `updatedAt` if present)
- [ ] ID values don't conflict (especially important for system records like user ID: 1)

## Error Handling

- [ ] Script has a try/catch wrapper around `main()`
- [ ] Errors are logged with context (which entity, which operation)
- [ ] Exit codes are correct: 0 for success, 1 for failure
- [ ] Sensitive data (passwords, tokens) are not logged

## Performance

- [ ] Batch operations use `createMany` instead of individual creates
- [ ] Unnecessary queries are avoided (use `createMany + skipDuplicates` vs. `upsert` loops)
- [ ] Large seed data is imported from external sources (files, APIs) if possible
- [ ] Script completes in reasonable time (< 30s for typical schema)

## Testing

- [ ] Run seed script twice: `pnpm prisma db seed` (verify idempotency)
- [ ] Check output in Prisma Studio: `pnpm prisma studio`
- [ ] Verify counts: Does data match expectations?
- [ ] Check relationships: Are FK links correct?
- [ ] Run migrations after schema changes: `pnpm prisma migrate dev`

## Example Patterns

### Good: Using Upsert for Idempotency

```typescript
await prisma.user.upsert({
  where: { email: 'admin@example.com' },
  update: {
    /* optional updates */
  },
  create: {
    email: 'admin@example.com',
    name: 'Admin User',
    password: hashedPassword,
  },
});
```

### Good: Batch Create with SkipDuplicates

```typescript
await prisma.permission.createMany({
  data: [
    { action: 'read', subject: 'users' },
    { action: 'create', subject: 'users' },
  ],
  skipDuplicates: true, // relies on @@unique constraint
});
```

### Avoid: Circular Dependency

```typescript
// BAD: User references Role that doesn't exist yet
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    roles: { connect: { id: 999 } }, // Role not created
  },
});

// GOOD: Create role first, then connect
const role = await prisma.role.upsert({
  where: { name: 'Admin' },
  create: { name: 'Admin' },
  update: {},
});

const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    roles: { connect: { id: role.id } },
  },
});
```

### Avoid: Non-Idempotent Seed

```typescript
// BAD: Runs multiple times, creates duplicates
await prisma.user.create({
  data: { email: 'user@example.com', name: 'User' },
});

// GOOD: Safe to run multiple times
await prisma.user.upsert({
  where: { email: 'user@example.com' },
  update: { name: 'User' }, // Update if exists
  create: { email: 'user@example.com', name: 'User' },
});
```

## Related Documentation

- [Prisma Seed Guide](https://www.prisma.io/docs/guides/database/seed-database)
- [Prisma Upsert Documentation](https://www.prisma.io/docs/orm/reference/prisma-client-reference#upsert)
