## Why

Cross-repo dependency check: the frontend's `wire-task-completion-and-checkout-gate` proposal
(Nhiệm vụ — Evidence Zone: attach photos/notes per task) needs somewhere to actually store an
uploaded photo. Checked against current backend code:

- Permission-wise, task completion is already Ready: Employee has `complete:tasks`
  (`prisma/seed.ts:411`), and `TaskService.complete` does its own server-side ownership check
  (`ensureEmployeeCanCompleteTask`, `task.service.ts:110`) independent of CASL conditions.
- But `CompleteTaskDto.evidence` is typed `unknown`, documented only as "Evidence JSON such as
  photo URLs" (`complete-task.dto.ts:10-12`) — implying the caller is expected to pass
  **already-uploaded** URLs. Searching the whole backend for `multer`, `FileInterceptor`, `S3`,
  or `diskStorage` returns **zero matches**. There is no file/image upload endpoint or storage
  integration anywhere in this backend today. The Evidence Zone literally cannot be built against
  the current API — there's nowhere to send a photo.
- This isn't a one-off need either: the still-not-started `add-delivery-receipt-ocr-approval`
  backend proposal (delivery receipt photos, for OCR) will need the exact same capability.
  Building this once, generically, now avoids solving the same problem twice later.

## What Changes

- Add a generic upload module (e.g. `src/modules/uploads/`) with an endpoint (e.g.
  `POST /uploads`) accepting multipart file(s) and returning a stored URL/reference per file,
  which callers (task-completion evidence today, delivery-receipt photos later) then reference by
  URL in their own DTOs — keep upload storage decoupled from any one feature's domain model.
- **Storage backend is a real infrastructure decision, not an implementation detail** — this repo
  appears to deploy on Railway (a `railway start script` was added in a recent commit). Railway's
  default filesystem is ephemeral: anything written to local disk is lost on the next deploy or
  restart. Storing uploaded photos on local disk in production would silently lose evidence
  photos the first time the service redeploys. Needs a deliberate choice between: (a) an
  S3-compatible object store (AWS S3, Cloudflare R2, Backblaze B2, etc.) — durable, small
  ongoing cost, standard approach; (b) a Railway persistent volume, if available on the current
  plan — check before assuming; (c) local disk only if this is accepted as acceptable for a
  low-stakes evidence-photo use case and the team is fine re-uploading after any redeploy
  (**not recommended** — flag explicitly as the wrong default).
- Add basic validation: file type allowlist (images only, for this use case), size limit,
  per-request file count limit.
- Wire `TaskService.complete`'s handling of `CompleteTaskDto.evidence` to validate that submitted
  URLs actually came from this upload mechanism (or at minimum sanity-check the shape) rather
  than accepting arbitrary strings — worth a design.md note, not necessarily a hard requirement
  for a first version.

## Capabilities

### New Capabilities
- `file-upload`: any authenticated caller can upload an image file and receive a durable URL to
  reference elsewhere in the API — a foundational capability, not scoped to tasks specifically.

## Impact

New `src/modules/uploads/` module, `package.json` (multer + a storage SDK depending on the
chosen backend), new env config (storage credentials/bucket name), possibly a small `Upload`/
`Attachment` Prisma model if tracking uploads as first-class records is wanted (vs. just
returning a URL with no DB record) — flag as a design.md question.

**Recommend a `design.md` before `openspec apply`** — the storage backend choice (S3-compatible
vs. Railway volume vs. local disk) has real cost/reliability tradeoffs and should be decided
deliberately, not defaulted into the easiest-to-code option.
