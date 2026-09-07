## Context

The backend has no file/image upload capability today — a full-repo search for `multer`,
`FileInterceptor`, `S3`, and `diskStorage` returns zero matches (see `proposal.md`). Two
consumers already need it:

- The frontend's `wire-task-completion-and-checkout-gate` proposal wants an Evidence Zone (photo
  attachment) on task completion. `CompleteTaskDto.evidence` is currently typed `unknown` and
  documented as accepting "already-uploaded" URLs — there's nowhere to upload to yet.
- The not-yet-started `add-delivery-receipt-ocr-approval` backend proposal will need the same
  capability for delivery receipt photos.

The repo deploys to Railway (`start:railway` script in `package.json`), whose default filesystem
is ephemeral — anything written to local disk is lost on the next deploy/restart. Storage backend
is therefore a real infrastructure decision, not an implementation detail.

## Goals / Non-Goals

**Goals:**
- Provide a generic, feature-agnostic upload endpoint (`POST /uploads`) that any authenticated
  caller can use to upload an image and get back a durable, publicly-fetchable URL.
- Persist files durably across Railway deploys/restarts.
- Track uploads as first-class Prisma records so orphan cleanup and auditing are possible later.
- Keep the implementation swappable off Cloudflare R2 later if ever needed (S3-compatible API).

**Non-Goals:**
- Feature-specific evidence/attachment domain logic (task-completion evidence validation,
  delivery-receipt OCR) — those consume this module's output URL but are out of scope here.
- Private/signed-URL access control on uploaded files — first version serves files via a public
  R2 URL; there is no per-file authorization check on read.
- Image processing (resizing, thumbnailing, EXIF stripping, compression) — raw upload only.
- Multi-file batch upload UX beyond a simple per-request count cap.
- Automated orphan-file cleanup job — the `Upload` model makes it *possible* later, but no
  cleanup job ships in this change.

## Decisions

### Storage backend: Cloudflare R2

Chosen over AWS S3 and a Railway persistent volume.

- **R2's free tier**: 10 GB-month storage, 1M Class A ops (writes) and 10M Class B ops (reads)
  per month, **free forever** (not a 12-month trial like AWS S3).
- **Egress is unconditionally free**, with no cap — this is the deciding factor over both AWS S3
  (egress billed, often the largest line item) and Backblaze B2 (egress free only up to 3x
  average stored data/month).
- S3-compatible API — implemented with the standard `@aws-sdk/client-s3` SDK, pointed at R2's
  endpoint instead of AWS's. Keeps a future migration off R2 low-cost if ever needed.
- At this app's scale (one shop, task-evidence + delivery-receipt photos, compressed phone
  photos well under 1 MB each), the free tier is expected to last a very long time before any
  paid tier is needed.

Ruled out: AWS S3 (free tier expires after 12 months, then egress-billed), Railway persistent
volume (ties storage to a Railway plan feature, not verified available, and is a less portable
choice than an S3-compatible API), local disk (proposal's own explicit non-recommendation —
Railway's filesystem is ephemeral).

### Upload flow: memory storage, direct stream to R2

`multer` runs in **memory storage**, not disk storage — the file buffer is streamed straight to
R2 via `PutObjectCommand` and never touches Railway's local disk, even transiently. This avoids
both the ephemeral-disk data-loss risk and any temp-file cleanup logic.

### `Upload` as a first-class Prisma model

A new `Upload` model tracks: `id` (Int autoincrement, per this repo's ID convention), `key`
(the R2 object key), `url`, `mimeType`, `sizeBytes`, `uploadedByUserId` (FK to `User`), plus the
repo's standard `createdAt/createdBy/updatedAt/updatedBy` audit columns. No soft delete, per repo
convention.

Rationale: without a DB record, R2 is the only source of truth for what's been uploaded, making
orphan cleanup (files uploaded but never referenced by a task/delivery-receipt) and auditing
("who uploaded this") impossible later without bucket-scanning. Cheap to add now, expensive to
retrofit after callers already depend on a bare-URL response shape.

### Validation

- MIME type allowlist: `image/jpeg`, `image/png`, `image/webp` — images only, per current known
  use cases (task evidence, delivery receipts).
- Per-file size cap: 5–10 MB (exact value TBD with mobile/web UX owner — a raw phone camera photo
  can exceed this before client-side compression; flagged as an open question below).
- Per-request file count cap to bound a single request's blast radius (exact value TBD, tasks.md
  will pick a starting default subject to revision).

### Authorization

Any authenticated caller may upload — `POST /uploads` is gated by `@RequirePermissions({ action:
'create', subject: 'uploads' })` per this repo's deny-by-default convention (see `CLAUDE.md`
Authorization section), with that permission granted broadly (e.g. to `Employee` and above) in
`prisma/seed.ts`, since any employee may need to attach evidence to their own task completions.
No CASL row-level condition is needed for `create` (nothing to scope against yet). A future
`read`/`delete` on `uploads` (e.g. an admin cleanup UI) would follow the same per-route pattern
if built later — out of scope for this change.

### Audit logging

`uploads` is **not** added to the audited-subjects list in `CLAUDE.md` (`time-logs`,
`leave-requests`, `assignments`, `payroll-entries`, `availability`, `attendance-history`,
`users`, `roles`, `permissions`, `role-permissions`) — an upload is a low-stakes, self-contained
create with its own `createdBy`/`createdAt` columns on the `Upload` row itself, not a mutation on
existing business state that needs before/after diffing. Revisit if a future `delete` endpoint is
added.

## Risks / Trade-offs

- **[Risk] Public R2 URLs mean no read-side access control** → Mitigation: acceptable for this
  use case (task-evidence and delivery-receipt photos aren't sensitive), but flagged as a
  Non-Goal so it isn't assumed to be handled. Revisit if a future upload use case needs privacy.
- **[Risk] No orphan cleanup means storage can accumulate unreferenced files** (e.g. a task
  completion is abandoned after photo upload) → Mitigation: the `Upload` model makes a future
  cleanup job possible; not built now since 10 GB free tier gives significant runway.
- **[Risk] Unvalidated `CompleteTaskDto.evidence` URLs** — proposal.md notes callers could submit
  arbitrary strings, not just URLs from this upload mechanism → Mitigation: out of scope for
  this change (feature-specific), but flagged here so the task-completion evidence change picks
  it up; at minimum a shape/host sanity-check is recommended there, not a hard requirement here.
- **[Trade-off] Memory-storage multer** buffers the whole file in process memory before
  streaming to R2, rather than a true streaming pipe → acceptable given the 5–10 MB per-file cap
  keeps peak memory bounded; would need revisiting if size limits grow substantially.

## Migration Plan

1. Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
   `R2_PUBLIC_URL` to `.env.example` and `src/common/env.validation.ts` (required, non-empty).
2. Add `Upload` model via `pnpm db:dev --name "add-upload-model"`.
3. Add `uploads` permission rows (`create`/`read`/`delete` for parity with other subjects, even
   though only `create` is wired to a route initially) to `prisma/seed.ts` and grant `create` to
   `Employee` and above.
4. Build `src/modules/uploads/` (module/service/controller/mapper/types/dto) following the
   `src/modules/employees/` reference structure.
5. Register `UploadsModule` in `src/app.module.ts`.
6. No data migration or backfill needed — this is new capability, not a change to existing data.
7. Rollback: revert the module registration and migration; no existing callers depend on this
   yet, so rollback has no downstream impact.

## Open Questions

- Exact per-file size cap (5 MB vs 10 MB) — needs confirmation from whoever owns the mobile/web
  upload UX, since it affects whether client-side compression is required before upload.
- Exact per-request file count cap — no hard requirement surfaced yet; tasks.md should pick a
  reasonable starting default (e.g. 5) subject to revision.
- Whether `R2_PUBLIC_URL` is a public R2.dev subdomain or a custom domain — affects how the
  service constructs returned URLs; defer to whoever provisions the R2 bucket.
