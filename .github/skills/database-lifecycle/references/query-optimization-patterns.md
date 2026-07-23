# Query Optimization Patterns

Guide for detecting and fixing inefficient Prisma queries in NestJS services.

## Problem: N+1 Query Pattern

### Definition

Fetching a list of records (1 query), then looping to fetch related data (N additional queries).

### Example Problem

```typescript
// BAD: N+1 queries (1 findMany + N loops)
const users = await prisma.user.findMany();

for (const user of users) {
  user.roles = await prisma.role.findMany({
    where: { users: { some: { id: user.id } } },
  });
}
// Total: 1 + users.length queries
```

### Solution: Use `.include()`

```typescript
// GOOD: 1 query with eager loading
const users = await prisma.user.findMany({
  include: {
    roles: true,
  },
});
```

## Problem: Deep Nesting Over Limit

### Definition

Prisma can include up to 10 nested relations deep, but performance degrades beyond 2-3 levels.

### Example Problem

```typescript
// SLOW: Deep nesting loads excessive data
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    roles: {
      include: {
        permissions: {
          include: {
            subjects: {
              include: {
                // ... 7 more levels
              },
            },
          },
        },
      },
    },
  },
});
```

### Solution: Shallow Includes + Separate Queries

```typescript
// GOOD: Fetch user with roles, then permissions separately
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    roles: true, // 2 levels deep max
  },
});

const permissions = await prisma.permission.findMany({
  where: {
    roles: { some: { id: { in: user.roles.map((r) => r.id) } } },
  },
});
```

## Problem: Fetching Entire Records When Only ID Needed

### Definition

Using `.include()` or `.select()` loads all fields, even when you only need the ID.

### Example Problem

```typescript
// WASTEFUL: Loads entire role objects just for IDs
const userRoles = await prisma.user.findUnique({
  where: { id: 1 },
  include: { roles: true }, // Includes all role fields
});
const roleIds = userRoles.roles.map((r) => r.id);
```

### Solution: Use `.select()` with `include`

```typescript
// GOOD: Loads only needed fields
const userRoles = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    roles: {
      select: { id: true }, // Only fetch ID
    },
  },
});
```

## Problem: Filtering After Fetching (In-Memory)

### Definition

Fetching all records then filtering in JavaScript instead of using WHERE clause.

### Example Problem

```typescript
// SLOW: Loads all users into memory, filters in JS
const activeUsers = (await prisma.user.findMany()).filter(
  (u) => u.status === 'ACTIVE',
);
// Database: SELECT * FROM users (all rows)
// Memory: Filter in JavaScript
```

### Solution: Filter in Database Query

```typescript
// GOOD: Database handles filtering
const activeUsers = await prisma.user.findMany({
  where: { status: 'ACTIVE' },
});
// Database: SELECT * FROM users WHERE status = 'ACTIVE'
```

## Problem: OR Conditions Without Indexes

### Definition

Using `OR` conditions on unindexed fields forces full table scans.

### Example Problem

```typescript
// Schema: no index on email or phone
const user = await prisma.user.findFirst({
  where: {
    OR: [{ email: 'user@example.com' }, { phoneNumber: '1234567890' }],
  },
});
// Result: Full table scan on both columns
```

### Solution: Add Indexes in Schema

```prisma
// schema.prisma
model User {
  id         Int     @id @default(autoincrement())
  email      String  @unique // Already indexed
  phoneNumber String

  @@index([phoneNumber]) // Add this for OR queries
}
```

## Problem: Pagination Without Proper Ordering

### Definition

Using `.skip()` and `.take()` without `.orderBy()` gives inconsistent results.

### Example Problem

```typescript
// UNRELIABLE: Order not guaranteed
const page1 = await prisma.user.findMany({
  skip: 0,
  take: 10,
});

const page2 = await prisma.user.findMany({
  skip: 10,
  take: 10,
  // Could have duplicate or missing records between pages
});
```

### Solution: Add Stable Ordering

```typescript
// GOOD: Consistent pagination
const page1 = await prisma.user.findMany({
  orderBy: { id: 'asc' }, // Stable ordering
  skip: 0,
  take: 10,
});

const page2 = await prisma.user.findMany({
  orderBy: { id: 'asc' },
  skip: 10,
  take: 10,
});
```

## Problem: Raw Queries Without Parameterization

### Definition

Concatenating user input into raw SQL (SQL injection risk).

### Example Problem

```typescript
// DANGEROUS: SQL injection vulnerability
const email = req.body.email; // Untrusted input
const user = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

### Solution: Use Parameterized Queries

```typescript
// GOOD: Safe from SQL injection
const email = req.body.email;
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;
// Prisma automatically parameterizes ${} variables
```

## Index Strategy Checklist

When queries are slow, check:

- [ ] **Foreign keys**: Every FK column should have an index

  ```prisma
  model Post {
    authorId Int
    @@index([authorId]) // Index for JOIN queries
  }
  ```

- [ ] **WHERE clauses**: Frequently filtered columns need indexes

  ```prisma
  model User {
    status String
    @@index([status]) // Index for WHERE status = ...
  }
  ```

- [ ] **OR conditions**: Columns used in OR need individual indexes

  ```prisma
  model User {
    email String @unique // Already indexed
    phone String
    @@index([phone]) // Add for OR queries
  }
  ```

- [ ] **Composite queries**: Multi-column filters need composite indexes

  ```prisma
  model UserRole {
    userId Int
    roleId Int
    @@unique([userId, roleId]) // Composite index
  }
  ```

- [ ] **Sort/pagination**: ORDER BY columns benefit from indexes
  ```prisma
  model Post {
    createdAt DateTime
    @@index([createdAt]) // Index for ORDER BY
  }
  ```

## Query Optimization Workflow

1. **Identify slow queries**

- Check application logs or APM tools
- Monitor response times in integration tests
- Use `PrismaClient` logging: `log: ['query']`

2. **Analyze the query**

- Is it fetching more data than needed? Add `.select()`
- Is it looping after fetch? Add `.include()`
- Is it filtering after fetch? Move to `.where()`
- Is it missing indexes? Check schema and add if needed

3. **Implement fix**

- Update the query in the service
- Add indexes to schema if needed
- Run `pnpm prisma migrate dev`
- Run tests to verify

4. **Measure improvement**

- Compare query count before/after
- Check response time improvement
- Verify no queries broke

## References

- [Prisma Select and Include](https://www.prisma.io/docs/orm/prisma-client/queries/select)
- [Prisma Indexes](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#index)
- [Prisma Query Optimization](https://www.prisma.io/docs/guides/performance-and-optimization)
