# File Upload Specification

## Purpose

Provide a generic, feature-agnostic way for an authenticated caller to upload
an image file and receive a durable, publicly-fetchable URL, so any feature
(task-completion evidence, delivery-receipt photos, etc.) can reference an
uploaded file by URL from its own DTOs without owning storage logic itself.
Files are persisted to an external object store rather than local application
disk, since this backend deploys to Railway, whose default filesystem is
ephemeral.

## Requirements

### Requirement: Authenticated upload endpoint
The system SHALL provide `POST /uploads`, gated by `@RequirePermissions({ action: 'create',
subject: 'uploads' })`, that accepts one or more multipart image files from an authenticated
caller and returns a stored, durable URL plus metadata for each accepted file.

#### Scenario: Authenticated caller uploads a valid image
- **WHEN** an authenticated user with the `create`/`uploads` permission submits a multipart
  request to `POST /uploads` containing a single JPEG file under the size limit
- **THEN** the system stores the file in the configured object storage, creates an `Upload`
  record, and responds with the upload's id, durable URL, mime type, and size

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request to `POST /uploads` is made without a valid access token
- **THEN** the system responds `401 Unauthorized` and does not store any file

#### Scenario: Caller lacking the upload permission is rejected
- **WHEN** an authenticated user without the `create`/`uploads` permission grant submits a
  request to `POST /uploads`
- **THEN** the system responds `403 Forbidden` and does not store any file

### Requirement: File type validation
The system SHALL reject any uploaded file whose MIME type is not on the configured image
allowlist (`image/jpeg`, `image/png`, `image/webp`), without storing it or creating an `Upload`
record.

#### Scenario: Disallowed file type is rejected
- **WHEN** an authenticated caller submits a file with MIME type `application/pdf` to
  `POST /uploads`
- **THEN** the system responds with a validation error, stores nothing in object storage, and
  creates no `Upload` record

### Requirement: File size validation
The system SHALL reject any uploaded file exceeding the configured per-file size limit, without
storing it or creating an `Upload` record.

#### Scenario: Oversized file is rejected
- **WHEN** an authenticated caller submits an image file larger than the configured per-file
  size limit to `POST /uploads`
- **THEN** the system responds with a validation error, stores nothing in object storage, and
  creates no `Upload` record

### Requirement: Per-request file count limit
The system SHALL reject a `POST /uploads` request whose file count exceeds the configured
per-request limit, without storing any of the submitted files.

#### Scenario: Too many files in one request
- **WHEN** an authenticated caller submits a multipart request to `POST /uploads` containing
  more files than the configured per-request limit
- **THEN** the system responds with a validation error and stores none of the submitted files

### Requirement: Durable storage independent of application filesystem
The system SHALL persist uploaded files to an external object store (not local application disk)
so that files remain retrievable across application deploys and restarts.

#### Scenario: File remains retrievable after a deploy
- **WHEN** a file was successfully uploaded via `POST /uploads` prior to an application
  redeploy or restart
- **THEN** the file's returned URL continues to resolve to the same file content after the
  redeploy or restart

### Requirement: Upload record tracks provenance
The system SHALL create an `Upload` record for every successfully stored file, capturing the
storage key, resulting URL, mime type, size in bytes, and the id of the `User` who uploaded it.

#### Scenario: Upload record captures uploader identity
- **WHEN** user X successfully uploads a file via `POST /uploads`
- **THEN** the resulting `Upload` record's `uploadedByUserId` equals user X's id
