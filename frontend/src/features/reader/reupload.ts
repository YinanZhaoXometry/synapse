/**
 * Re-upload validation for the reader (FR-29 relaxed contract): after a reload
 * a Material's metadata persists but its bytes are gone, and the reader offers
 * the re-upload affordance. The candidate file must match the material's own
 * kind and fit the attach cap — the epic-2 upload contract, mirrored here as a
 * pure function because AD-2 keeps the reader from importing features/plans
 * internals (the constant and kind-detection follow upload-validation.ts).
 */

/** The attach cap (FR-2: PDF/Markdown ≤ 20 MB) — same boundary as epic-2. */
export const REUPLOAD_MAX_BYTES = 20 * 1024 * 1024;

const EXTENSION_KIND: Record<string, "pdf" | "markdown"> = {
  ".pdf": "pdf",
  ".md": "markdown",
  ".markdown": "markdown",
};

const CONTENT_TYPE_KIND: Record<string, "pdf" | "markdown"> = {
  "application/pdf": "pdf",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/** The candidate's kind, decided the same way attach-time validation decides it. */
export function reuploadKind(file: { name: string; type: string }): "pdf" | "markdown" | null {
  const extension = extensionOf(file.name);
  return extension ? EXTENSION_KIND[extension] ?? null : CONTENT_TYPE_KIND[file.type.toLowerCase()] ?? null;
}

export type ReuploadValidation = { ok: true } | { ok: false; messageKey: string };

/**
 * Accept decision for re-uploading one material's session bytes: the file must
 * be the same kind as the material (a PDF row does not accept a .md — the
 * metadata and already-extracted sections stay the row's truth) and within the
 * 20 MB cap. Rejections carry the i18n key of a bilingual reason.
 */
export function validateReupload(
  file: { name: string; type: string; size: number },
  materialKind: "pdf" | "markdown",
): ReuploadValidation {
  if (reuploadKind(file) !== materialKind) return { ok: false, messageKey: "reader.reuploadKindMismatch" };
  if (file.size > REUPLOAD_MAX_BYTES) return { ok: false, messageKey: "errors.uploadTooLarge" };
  return { ok: true };
}
