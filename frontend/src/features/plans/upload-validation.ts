/**
 * Upload validators (FR-2; spec testing seam 3): pure accept/reject/size logic
 * for attaching a Material to a plan. PDF and Markdown, ≤ 20 MB — plus `.pptx`
 * as a MARKDOWN-pipeline input (epic-13 T5, owner Q6): the reader parses a
 * pptx client-side into markdown-kind sections (parse-pptx), so it rides the
 * markdown kind end-to-end — attach, sections, reader render, quiz sourcing —
 * and the server's pdf|markdown kind enum is untouched. Anything else is
 * rejected with the i18n key of a bilingual reason naming what is supported.
 * No parsing happens here; parsing is the Reader epic's public API (AD-7, Q1).
 */

/** The attach cap (AD-4); a file of EXACTLY this size passes (PRD FR-2: ≤ 20 MB uploads) — anything larger is rejected. */
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
  ".pptx": "markdown", // epic-13 T5: pptx parses INTO markdown-kind sections client-side
};

const PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const KIND_BY_CONTENT_TYPE: Record<string, UploadKind> = {
  "application/pdf": "pdf",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
  [PPTX_CONTENT_TYPE]: "markdown",
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
 * Whether this candidate is a pptx (epic-13 T5): the one accepted kind whose
 * extraction has a stated limitation (text only — image content won't
 * appear), so the attach flows surface the bilingual note when it passes.
 */
export function isPptxUpload(file: UploadFileSpec): boolean {
  return extensionOf(file.name) === ".pptx" || file.type.toLowerCase() === PPTX_CONTENT_TYPE;
}

/**
 * Accept decision for one candidate file: a filename with an extension stands
 * by its name (the extension is what the user controls — a `.txt` claiming to
 * be markdown in its MIME header is still not attachable); only extension-less
 * filenames fall back to the content-type. Size is checked once the type is
 * accepted, at the 20 MB boundary (the cap itself is allowed — FR-2).
 */
export function validateUpload(file: UploadFileSpec): UploadValidation {
  const extension = extensionOf(file.name);
  const kind = extension ? KIND_BY_EXTENSION[extension] : KIND_BY_CONTENT_TYPE[file.type.toLowerCase()];
  if (!kind) return { ok: false, messageKey: "errors.uploadUnsupportedType" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, messageKey: "errors.uploadTooLarge" };
  return { ok: true, kind, title: titleFromFilename(file.name) };
}
