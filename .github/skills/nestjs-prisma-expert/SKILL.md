---
name: nestjs-prisma-expert
description: Advanced guidance for building scalable NestJS applications using Prisma ORM and PostgreSQL.
---

# NestJS & Prisma Expert Skill

**Description:** Advanced guidance for building scalable NestJS applications using Prisma ORM and PostgreSQL.

## Instructions

### 🏗️ Architectural Standards

- **Modular Design:** Always organize the code by feature modules in `src/modules/`. Each module should contain its own controllers, services, and DTOs.
- **Layer Separation:** - **Controllers:** Handle HTTP requests and responses only.
  - **Services:** All business logic must reside here.
  - **DTOs:** Use `class-validator` and `class-transformer` for every input.
- **Dependency Injection:** Strictly follow NestJS DI patterns. Use Global Modules for shared services like `PrismaService`.

### 🛡️ Type Safety & Patterns

- **`any` is allowed but should be avoided:** `eslint.config.mjs` turns `@typescript-eslint/no-explicit-any` off in this repo, so it won't fail lint — but still prefer explicit types for variables, function returns, and API responses; only reach for `any` when a Prisma/third-party type genuinely can't be expressed cleanly.
- **Custom Decorators:** Create custom decorators for repeated logic (e.g., `@AuthenticatedUser()` for extracting the user from the JWT payload, `@RequirePermissions()` for authorization — see `src/common/decorators/` and `src/modules/auth/decorators/`).
- **Interceptors/Filters:** Global exception filters (`PrismaExceptionFilter`, `GlobalExceptionFilter`, registered in `src/common/exception.module.ts`) already give consistent error responses — don't add per-controller try/catch for the same errors they handle.

### 💎 Prisma & Database Workflow

- **Single Source of Truth:** `schema.prisma` is the only source for DB structure.
- **The Protocol:** Whenever the schema changes:
  1. Update `schema.prisma`.
  2. Run `pnpm db:dev --name <description>` (wraps `prisma migrate dev`, which also regenerates the client).
- **Performance:** Use `select` to minimize data transfer. Avoid deep nested `include` to prevent performance bottlenecks.
- **Conventions:** `Int` autoincrement ids, no soft deletes, `createdAt/createdBy/updatedAt/updatedBy` audit columns on every mutable model — see the `schema-review` skill for the full checklist.

### 🤖 Agentic Workflow

- **Build Check:** Run `pnpm build` (and `pnpm lint`) before considering a task "done".
- **Self-Healing:** If a terminal command fails, analyze the stack trace and fix the code before reporting back.
- **Git Protocol:** Match this repo's actual branch naming (e.g. `feature/<name>`, see `git branch`/`git log`) rather than assuming a fixed prefix; use clear, descriptive commit messages. Only push or open PRs if the user explicitly asks.
