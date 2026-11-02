/**
 * Upload validators (FR-2; spec testing seam 3): pure accept/reject/size logic
 * for attaching a Material to a plan. PDF and Markdown only, ≤ 20 MB —
 * anything else is rejected with the i18n key of a bilingual reason naming
 * what is supported today (PPT = Phase 2). No parsing happens here; parsing
 * is the Reader epic's public API (AD-7, Q1).
 */

/** The attach cap (AD-4); a file of exactly this size is rejected — just under passes. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadKind = "pdf" | "markdown";

/** i18n keys of the rejection reasons (errors.* — where material errors live, AppError convention). */
export type UploadRejectionKey = "errors.uploadUnsupportedType" | "errors.uploadTooLarge";

export type UploadValidation =
  | { ok: true; kind: UploadKind; title: string }
  | { ok: false; messageKey: UploadRejectionKey };

/** The files enter as plain data; a real DOM File satisfies this structurally. */
export interface UploadFileSpec {
  name: string;
  type: string;
  size: number;
}

const KIND_BY_EXTENSION: Record<string, UploadKind> = {
  ".pdf": "pdf",
  ".md": "markdown",
  ".markdown": "markdown",
};

const KIND_BY_CONTENT_TYPE: Record<string, UploadKind> = {
  "application/pdf": "pdf",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/** Title for the Material row: the filename minus its final extension (never empty). */
export function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const stripped = dot > 0 ? name.slice(0, dot) : name;
  return stripped.length > 0 ? stripped : name;
}

/**
 * Accept decision for one candidate file: a filename with an extension stands
 * by its name (the extension is what the user controls — a `.txt` claiming to
 * be markdown in its MIME header is still not attachable); only extension-less
 * filenames fall back to the content-type. Size is checked once the type is
 * accepted, at the strict 20 MB boundary.
 */
export function validateUpload(file: UploadFileSpec): UploadValidation {
  const extension = extensionOf(file.name);
  const kind = extension ? KIND_BY_EXTENSION[extension] : KIND_BY_CONTENT_TYPE[file.type.toLowerCase()];
  if (!kind) return { ok: false, messageKey: "errors.uploadUnsupportedType" };
  if (file.size >= MAX_UPLOAD_BYTES) return { ok: false, messageKey: "errors.uploadTooLarge" };
  return { ok: true, kind, title: titleFromFilename(file.name) };
}
