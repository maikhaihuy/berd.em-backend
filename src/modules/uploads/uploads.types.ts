export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const MIME_TYPE_EXTENSIONS: Record<AllowedUploadMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Defaults used when UPLOAD_MAX_FILE_SIZE_BYTES / UPLOAD_MAX_FILES_PER_REQUEST
// are not set — see design.md's Open Questions for the reasoning behind these
// starting values.
export const DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const DEFAULT_UPLOAD_MAX_FILES_PER_REQUEST = 5;
