## 1. Dependencies & environment

- [x] 1.1 Add `@aws-sdk/client-s3` and `multer` (memory storage; `@types/multer` if not already
      present) to `package.json`.
- [x] 1.2 Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
      `R2_PUBLIC_URL` to `.env.example` with placeholder values.
- [x] 1.3 Add the same five variables as required, non-empty `@IsString()` fields to
      `src/common/env.validation.ts`'s `EnvVariables` class.
- [x] 1.4 Add `UPLOAD_MAX_FILE_SIZE_BYTES` and `UPLOAD_MAX_FILES_PER_REQUEST` as optional env
      vars (with sane in-code defaults, e.g. 8 MB and 5) so the limits from design.md's Open
      Questions can be tuned without a code change once confirmed.

## 2. Data model

- [x] 2.1 Add an `Upload` model to `prisma/schema.prisma`: `id` (Int autoincrement PK), `key`
      (String, unique), `url` (String), `mimeType` (String), `sizeBytes` (Int),
      `uploadedByUserId` (Int, FK to `User`), plus the standard `createdAt/createdBy/updatedAt/
      updatedBy` audit columns. No soft delete, per repo convention.
- [x] 2.2 Run `pnpm db:dev --name "add-upload-model"` to generate and apply the migration.
- [x] 2.3 Add `uploads` permission rows (`create`, `read`, `delete`) to `prisma/seed.ts`
      following the existing per-subject loop convention.
- [x] 2.4 Grant `create`/`uploads` to the `Employee` role (and implicitly `Manager`/`Admin` via
      their broader grants) in `prisma/seed.ts`.
- [x] 2.5 Re-run `pnpm db:seed` locally and confirm the new permission rows and role grant land
      without errors.

## 3. R2 storage client

- [x] 3.1 Create `src/modules/uploads/r2-storage.service.ts` wrapping `@aws-sdk/client-s3`'s
      `S3Client` (constructed with R2's endpoint from `R2_ACCOUNT_ID`) and exposing a single
      method to put an object (buffer, key, content-type) and return the resulting public URL
      built from `R2_PUBLIC_URL`.
- [x] 3.2 Generate object keys that avoid collisions (e.g. a random/UUID-based key, optionally
      namespaced by date), independent of the original filename.

## 4. Uploads module

- [x] 4.1 Scaffold `src/modules/uploads/` following the `src/modules/employees/` reference
      structure: `uploads.module.ts`, `uploads.service.ts`, `uploads.controller.ts`,
      `uploads.mapper.ts`, `uploads.types.ts`, `dto/upload-response.dto.ts`.
- [x] 4.2 Implement `POST /uploads` in `uploads.controller.ts` using `FilesInterceptor` (multer,
      `memoryStorage()`) with the per-request file count limit from env, and
      `@RequirePermissions({ action: 'create', subject: 'uploads' })`.
- [x] 4.3 Implement MIME-type allowlist validation (`image/jpeg`, `image/png`, `image/webp`) and
      per-file size validation against `UPLOAD_MAX_FILE_SIZE_BYTES`, rejecting the whole request
      (storing nothing) on any violation — via a multer `fileFilter`/`limits` config plus an
      explicit check in the interceptor pipeline, matching the "store nothing on any violation"
      behavior from specs/file-upload/spec.md.
- [x] 4.4 Implement `uploads.service.ts`: for each accepted file, stream to R2 via
      `R2StorageService`, then create an `Upload` row (`uploadedByUserId` from the authenticated
      caller) inside a `$transaction` if multiple files are uploaded in one request, or a single
      write for one file.
- [x] 4.5 Implement `uploads.mapper.ts` (`UploadMapper.toDto`) translating the Prisma `Upload`
      row to the response DTO (id, url, mimeType, sizeBytes, createdAt).
- [x] 4.6 Wire Swagger decorators on the controller (multipart consumes, response DTO array
      shape) consistent with other modules' Swagger usage.
- [x] 4.7 Register `UploadsModule` in `src/app.module.ts`'s `imports` array.

## 5. Tests

- [x] 5.1 Unit test `uploads.service.ts`: successful upload creates an `Upload` row with the
      correct `uploadedByUserId`; R2 client is mocked, not called against real infrastructure.
- [x] 5.2 Unit test validation paths: disallowed MIME type, oversized file, and over-count
      request each reject without calling the storage client or creating an `Upload` row.
- [x] 5.3 E2e test (`test/uploads.e2e-spec.ts`): authenticated caller with `create`/`uploads`
      permission uploads a small in-memory test image and receives a 2xx response with a URL;
      unauthenticated request gets 401; caller without the permission gets 403. Stub/mock the R2
      client at the e2e boundary so tests don't hit real Cloudflare infrastructure.

## 6. Documentation

- [x] 6.1 Add a short "File uploads" section to `CLAUDE.md` (and mirror in `AGENTS.md` per the
      docs-sync note at the top of `CLAUDE.md`) covering: `POST /uploads`, the R2 storage
      backend choice, the five `R2_*` env vars, and the `Upload` model — so future work (e.g.
      task-completion evidence, delivery-receipt OCR) knows this exists before reinventing it.
      NOTE: `AGENTS.md` does not actually exist anywhere in this repo despite CLAUDE.md's docs
      note claiming the two are kept in sync — nothing to mirror into; flagged to the user rather
      than created fresh (out of scope for this change to originate that file).
