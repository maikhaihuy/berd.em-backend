---
name: openspec-consolidate
description: Use when openspec/specs/ has drifted from openspec/changes/archive/ and needs a consolidation pass — the archive has grown, specs feel stale, or it's time for a periodic OpenSpec hygiene pass. Folds still-relevant archived requirements into specs/ so specs/ stays the single source of truth for current system behavior, without turning it into a changelog. Do not use for reviewing a single not-yet-archived change (that's /opsx:apply/opsx:archive) — this is specifically for reconciling the accumulated archive against specs/.
---

# OpenSpec — Consolidate Archived Changes into Current Specs

## Objective

Make `openspec/specs/` the **single source of truth for current system behavior**, while
keeping `openspec/changes/archive/` untouched as historical record.

Review archived changes, identify requirements/behaviors/rules/constraints that are part of the
current system but missing or outdated in `specs/`, and update `specs/` accordingly.

**Do NOT** copy archived change specs verbatim into `specs/`. The final specs describe what the
system does **today** — not the chronological history of how it got there.

---

## Step 0 — Build an index first

Before deep-diving into any single archived change, enumerate all of them into a scratch index:

| Archive folder | Date (from name/metadata/`git log`) | Domain/capability | One-line summary |
|---|---|---|---|

With a large archive, this index is what keeps the pass tractable — it's the checklist you work
off in Step 4, and the artifact you can show for review instead of re-reading everything from
scratch next time. Sort chronologically; this ordering is also how you'll resolve "which change
is more current" in Step 3 when two archived changes conflict — prefer the one with the later
date, and fall back to `git log` on the archive folder if the date isn't otherwise recoverable.

Do not modify anything in this step.

---

## Step 1 — Inspect the OpenSpec structure

Inspect, without modifying anything yet:

- `openspec/specs/`
- `openspec/changes/archive/` (or the actual archive location, if different)
- `openspec/project.md` — the durable project context and capability/domain taxonomy already in
  use. New spec files in Step 4 must fit this taxonomy, not invent a parallel one.
- Repository source code when needed to resolve ambiguity. **This repo's own convention wins
  ties**: if a doc (archived change, existing spec, or your own draft) ever contradicts
  `prisma/schema.prisma` or the actual `src/` code, the code wins.

---

## Step 2 — Analyze archived changes

Classify each archived change's content into:

**A. Current behavior** — still part of the current system (a still-existing entity, an active
workflow, an enforced permission rule, a valid business rule, a domain state/status still in
use, a currently required validation). → belongs in `specs/`.

**B. Superseded behavior** — later changed by a subsequent archived change. Do not merge blindly;
use the latest/current behavior instead (see Step 0's chronological index).

**C. Deprecated/removed behavior** — intentionally removed or replaced. Do not add to `specs/`.

**D. Historical implementation detail** — temporary decisions, migration steps, refactor/rollout
plans. Do not add to `specs/` unless still relevant to current behavior.

**E. Already documented** — accurately represented in `specs/` already. Do not duplicate.

---

## Step 3 — Establish the current truth

Priority order when determining what belongs in `specs/`:

1. Current source code / current system behavior (`src/`, `prisma/schema.prisma`) — per this
   repo's own stated convention, code wins over any doc.
2. The latest relevant OpenSpec change (by the chronological index from Step 0).
3. Existing current spec.
4. Older archived changes.

If an archived change conflicts with current implementation or a newer change, prefer the
current behavior. Do not resurrect old requirements just because they appear in the archive.

If current behavior can't be confidently determined, flag it for review (Step 6) instead of
guessing.

---

## Step 4 — Map archived changes to current specs

Working through the Step 0 index (batch by domain/capability if the list is long — see the note
at the end of this step), for each relevant archived change determine:

- Which domain/capability does it belong to (per `openspec/project.md`'s taxonomy)?
- Which existing `specs/<capability>/spec.md` should be updated?
- Does a new spec file genuinely need to be created, or does it fit an existing one?
- Which requirements are already documented (class E)?
- Which are missing (class A, not yet in `specs/`)?
- Which requirements in the current spec are now outdated (superseded by a class A/B finding)?

Prefer updating existing specs over creating new files.

**If the archive list is large**: process in batches grouped by domain/capability rather than
strictly chronologically across the whole set — it's easier to keep one capability's spec
internally consistent that way. Re-run the Step 6 contradiction check at the end of each batch,
then once more across the full set at the end, since a contradiction between an early batch and
a late batch won't surface from a single within-batch check.

---

## Step 5 — Update the specs

**Preserve current information** — don't remove valid existing requirements without strong
evidence they're obsolete.

**Consolidate** — if multiple archived changes describe incremental modifications to the same
feature, merge them into one coherent current-state description. E.g., instead of narrating "Add
shift → Add sub-shift → Change shift status → Add approval → Improve assignment," describe the
final domain shape directly: entities, lifecycle, and rules as they exist today.

**Avoid historical narration** — don't write "Originally we implemented X, then changed to Y,"
unless the historical distinction itself matters to current behavior. Write "The system uses Y."

**Avoid implementation details** — favor business/domain behavior over code-level detail, unless
the spec file explicitly exists to document technical architecture.

**Work on a dedicated branch.** This pass touches many files under `specs/` at once — don't
commit or push without the user reviewing the diff first.

---

## Step 6 — Detect contradictions

Check for contradictions between: archived changes, existing specs, your newly updated specs,
and current source code. Pay particular attention to entity names, status values,
lifecycle/state transitions, permissions, validation rules, business rules, relationships, API
behavior, and terminology.

If two sources conflict and the correct current behavior can't be determined, do **not** silently
pick one. List it under Needs Review:

```text
## Needs Review

1. Shift assignment status
   - Archive A says: Pending → Approved
   - Archive B says: Draft → Published → Locked
   - Current code suggests: ...
   - Decision required: ...
```

---

## Step 7 — Quality check

Before finishing, verify:

- Every important current domain behavior found in the archive is represented.
- No obviously deprecated behavior was reintroduced.
- No historical implementation detail was added unnecessarily.
- No duplicate requirements were created.
- Terminology is consistent across specs.
- Related specs don't contradict each other.
- Specs describe the current system, not the change history.

---

## Constraints

- **Do NOT delete, modify, or rename anything under `archive/`.** This pass only writes to
  `specs/`.
- **Do NOT invent requirements, resurrect deprecated behavior, or silently resolve
  contradictions.** When uncertain, leave it in the archive and flag it for review rather than
  guessing.

---

## Output

Provide a concise report:

### 1. Specs Updated
Each modified spec file and a summary of what was added/changed.

### 2. New Specs
Any new spec files created, and why an existing spec didn't fit.

### 3. Archived Changes Processed
Which archived changes contributed meaningful current-state requirements (reference the Step 0
index).

### 4. Ignored Historical Changes
Changes intentionally not merged, and why: superseded / deprecated / implementation-only /
already documented.

### 5. Needs Review
Anything ambiguous or contradictory requiring human confirmation (from Step 6).

### 6. Final Assessment
Answer directly: is `openspec/specs/` now a reliable source of truth for the current system,
based on available evidence? Don't claim certainty if meaningful ambiguity remains.