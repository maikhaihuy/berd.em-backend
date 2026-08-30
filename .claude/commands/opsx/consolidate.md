---
name: "OPSX: Consolidate"
description: "Consolidate openspec/changes/archive/ into openspec/specs/ so specs stay the single source of truth for current system behavior"
allowed-tools: Bash(openspec:*), Bash(git:*)
category: "Workflow"
tags: ["workflow", "specs", "archive", "maintenance"]
---

Fold still-relevant archived changes into `specs/`, so `specs/` describes what the system does
**today** — not the chronological history of how it got there. `archive/` stays untouched as
historical record.

This is different from `/opsx:propose`/`/opsx:apply`: it doesn't create or advance a single
change through its artifact lifecycle. It reconciles the *accumulated* archive against the
current specs, across as many past changes as needed.

**This command is the CLI-mechanics layer only.** The classification rules (current / superseded
/ deprecated / historical-detail / already-documented), the priority order for resolving
conflicts, the consolidation-writing guidance, and the output report format all live in the
`openspec-consolidate` skill (`.claude/skills/openspec-consolidate/SKILL.md`) — **load and follow
that skill's Steps 2 onward for the actual analysis.** Do not re-derive or duplicate that
methodology here; if it needs to change, change it in the skill, not in this file.

---

**Store selection:** If the user names a store, or the work lives in one, run
`openspec store list --json` to discover registered store ids, then pass `--store <id>` on every
command below that reads specs/changes (`list`, `show`, `validate`, `archive`, `doctor`,
`context`, `view`). Without a store, commands act on the nearest local `openspec/` root.

**Input**: The argument after `/opsx:consolidate` is either a capability/domain name to scope the
pass to (e.g. `scheduling`), or empty/`all` to consolidate the entire archive.

---

**Steps**

1. **Resolve paths and scope**
   ```bash
   openspec context --json
   ```
   This returns `root.path` (the openspec root for this repo) — it does **not** return
   `specsPath`/`archiveRoot` as separate fields, so don't assume those exist. Derive them from
   `root.path` using the standard OpenSpec layout:
   - specs: `<root.path>/openspec/specs`
   - archive: `<root.path>/openspec/changes/archive`

   Then verify both actually exist before proceeding:
   ```bash
   ls <root.path>/openspec/specs
   ls <root.path>/openspec/changes/archive
   ```
   If either path doesn't exist, check `openspec doctor` or `openspec --help` for this repo's
   actual layout rather than guessing further — conventions can differ per repo/CLI version.

   If the user gave no capability scope, confirm: "Consolidate the entire archive, or a specific
   capability?" Do not silently assume "all" for a large, never-before-consolidated archive —
   the first pass on a long archive is exactly where a scoped, reviewable run is more useful than
   one giant diff.

2. **Build an index of archived changes first**

   This CLI's `archive` command only archives a change *forward* — there is no subcommand that
   lists what's already archived. Once a change is archived it's a plain directory on disk, not
   something the CLI indexes. Enumerate it directly from the filesystem, using the archive path
   verified in Step 1:
   ```bash
   ls <root.path>/openspec/changes/archive
   ```
   For each entry found, read its `proposal.md` (and `design.md` if present) directly with a
   file-read tool to pull a one-line summary — don't assume `openspec show`/`openspec instructions`
   work on archived entries; those are built around the active-change lifecycle and may not
   resolve a change that's already left it. Build a scratch table:

   | Archive entry | Date | Domain/capability | One-line summary |
   |---|---|---|---|

   Sort chronologically. This table is what Step 4 works off, and what "latest wins" in Step 3
   is resolved against — prefer the later date when two archived changes conflict, falling back
   to `git log` on the archive path if date isn't otherwise recoverable. Do not modify anything
   yet.

3. **Hand off to the skill**

   With the index from Step 2 in hand and the paths verified in Step 1, load
   `.claude/skills/openspec-consolidate/SKILL.md` and follow it from its Step 2 (Analyze archived
   changes) through its Step 7 (Quality check) — classification rules, conflict-resolution
   priority, batching, consolidation-writing guidance, contradiction detection, and the output
   report format are all defined there, not here.

   Pass through what this command already resolved so the skill doesn't redo it:
   - Verified paths: `<root.path>/openspec/specs`, `<root.path>/openspec/changes/archive`
   - The Step 2 archive index (entries, dates, one-line summaries)
   - The scope argument from Input (a specific capability, or "all")

4. **Validate**
   ```bash
   openspec validate --json
   ```
   Run this after the skill finishes updating `specs/`. Fix anything flagged before reporting
   done; re-run until clean, or surface a persistent failure as Needs Review in the skill's
   output report.

5. **Show final status**
   ```bash
   openspec status --json
   ```

---

**Output**

Use the skill's Step 7 report format (Specs Updated / New Specs / Archived Changes Processed /
Ignored Historical Changes / Needs Review / Final Assessment) — don't reformat it here.

**Guardrails**
- Never modify, rename, or delete anything under `archive/` — this command and the skill it
  invokes only write to `specs/`.
- Re-read dependency files from disk before using them, even if seen earlier in the
  conversation — they may have changed.
- If the skill file can't be found at the expected path, stop and tell the user rather than
  falling back to ad-hoc consolidation logic — the methodology living in one place is the point.