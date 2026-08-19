# Using OpenSpec with Claude Code in this repo

## Two ways to invoke it (same result)

Claude Code discovered both a slash command set and a skill set (see `.claude/commands/opsx/` and `.claude/skills/openspec-*/`) — they're generated twins of the same 6 workflows. Just use the slash commands; they're the more explicit/predictable entry point:

| Command | What it does |
|---|---|
| `/opsx:explore` | Thinking-only mode — investigate, discuss, no code or artifact writes unless you ask |
| `/opsx:propose <name or description>` | Scaffolds a new change and generates all its planning artifacts |
| `/opsx:update [change]` | Revises an existing change's artifacts, keeping them mutually coherent (never touches code) |
| `/opsx:apply [change]` | Implements the change's `tasks.md`, checking off tasks as it goes |
| `/opsx:sync [change]` | Merges a change's delta specs into the main `openspec/specs/` (usually run automatically during archive) |
| `/opsx:archive [change]` | Moves a finished change into `openspec/changes/archive/`, syncing specs first |

This repo's schema is `spec-driven` (`openspec/config.yaml`), so a proposal produces 4 artifacts: `proposal.md`, `specs/<capability>/spec.md` (delta), `design.md`, `tasks.md`.

## The lifecycle

```
/opsx:explore  (optional — think it through first)
       │
       ▼
/opsx:propose "add pay periods module"
       │   creates openspec/changes/add-pay-periods/
       │     ├─ proposal.md   (what & why)
       │     ├─ design.md     (how)
       │     ├─ specs/pay-periods/spec.md   (delta: ADDED/MODIFIED/REMOVED requirements)
       │     └─ tasks.md      (implementation checklist)
       ▼
/opsx:update add-pay-periods      (only if you need to revise the plan before/while implementing)
       ▼
/opsx:apply add-pay-periods
       │   works through tasks.md, checks boxes, writes code
       ▼
/opsx:archive add-pay-periods
       │   syncs specs/pay-periods/spec.md → openspec/specs/pay-periods/spec.md
       │   moves the change to openspec/changes/archive/2026-08-19-add-pay-periods/
       ▼
done — openspec/specs/ now reflects reality
```

`openspec/specs/authorization/spec.md` is the one existing example of a fully-synced main spec — that's the target shape everything eventually merges into.

## Where things live in this repo

- `openspec/project.md` — durable context (tech stack, conventions, domain model) that's automatically fed into every artifact-generation step. Already populated from this session's audit.
- `openspec/specs/<capability>/spec.md` — the current source of truth per capability, once synced.
- `openspec/changes/<name>/` — an in-progress change's working artifacts (currently empty — nothing in flight).
- `openspec/changes/archive/` — completed changes, dated.

## A concrete first run

This project has an actual open TODO worth using as a first change — `TODO: Add PayPeriodsModule when created` / `TODO: Add PayrollEntriesModule when created` in `src/app.module.ts:60-61`. Example:

```
/opsx:propose add pay-periods and payroll-entries modules for the payroll domain
```

Claude will read `openspec/project.md` + `prisma/schema.prisma` (which already defines `PayPeriod`/`PayrollEntry` models) for context, then generate the proposal/design/spec/tasks. You'd review those, then:

```
/opsx:apply add-pay-periods-and-payroll-entries
```

to implement module-by-module, and `/opsx:archive` once done and tested.

## A couple of things worth knowing

- **`@RequirePermissions` is deny-by-default** — any new route the `apply` step generates needs a matching `Permission` seed row (`prisma/seed.ts`) or every call 403s. Worth double-checking after `/opsx:apply` runs.
- The installed OpenSpec CLI is `1.5.0`, one minor version behind the `generatedBy: 1.7.0` metadata stamped on these command/skill files — the commands they call (`new`, `status`, `instructions`, `archive`, `list`) all exist on 1.5.0, so nothing here is broken, but `/opsx:continue` and `/opsx:new` (mentioned as fallbacks in `update.md`) aren't installed — if you hit a message suggesting one of those, use the `openspec status`/`openspec instructions` CLI fallback it describes instead.
- `/opsx:update` and `/opsx:apply` never invent scope on their own — they ask before writing, and `/opsx:apply` pauses on anything ambiguous rather than guessing.
