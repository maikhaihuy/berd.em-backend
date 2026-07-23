---
name: nestjs-prisma-expert
description: Advanced guidance for building scalable NestJS applications using Prisma ORM and PostgreSQL.
modeSlugs:
  - code
  - architect
  - orchestrator
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

- **No 'any':** Explicitly define types for all variables, function returns, and API responses.
- **Custom Decorators:** Create custom decorators for repeated logic (e.g., extracting User from JWT).
- **Interceptors/Filters:** Use Global Exception Filters for consistent error responses.

### 💎 Prisma & Database Workflow

- **Single Source of Truth:** `schema.prisma` is the only source for DB structure.
- **The Protocol:** Whenever the schema changes:
  1. Update `schema.prisma`.
  2. Run `npx prisma migrate dev --name <description>`.
  3. Run `npx prisma generate` to sync the client.
- **Performance:** Use `select` to minimize data transfer. Avoid deep nested `include` to prevent performance bottlenecks.

### 🤖 Agentic Workflow

- **Build Check:** Always run `npm run build` before considering a task "done".
- **Self-Healing:** If a terminal command fails, analyze the stack trace and fix the code before reporting back.
- **Git Protocol:** - Create a feature branch: `feat/<feature-name>`.
  - Use Conventional Commits: `type(scope): message`.
  - Use GitHub MCP to push and create PRs.

## Tools

- `read_file`, `write_to_file`, `execute_command`, `list_files`
- `mcp-server-github` (for PR and code submission)
