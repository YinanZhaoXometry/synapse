/**
 * Reader anchor params (AD-8): `?page=N` for PDF deep links, `#section-id` for
 * Markdown, plus the transient `?hl=1` highlight flag — the ONLY cross-feature
 * command channel into the reader, reused internally by citation chips (T5).
 * Pure parsing so deep links are testable without a router; callers clamp
 * against the real document once it is open (see pager.clampPage and
 * MarkdownFlow's honest no-op for unknown sections).
 */

/** How long the citation-tint flash stays visible (AD-8: brief, once) — one
 * value shared by both reader branches, so the two flash identically. */
export const READER_FLASH_MS = 1400;

/** What an anchor query string + hash ask the reader to do. */
export interface ReaderAnchor {
  /** 1-based PDF page target; null when the link carries no page anchor (or an unusable one). */
  page: number | null;
  /** Markdown section target (a rendered heading id, hash-decoded); null when the link carries no hash (or an unusable one). */
  section: string | null;
  /** The transient `?hl=1` flag — flash the target in the citation tint, once. */
  highlight: boolean;
}

/**
 * Parse a location.search into the search half of a ReaderAnchor. `page`
 * accepts positive integers only ("3" → 3); anything else — "0", "-2", "3.5",
 * "abc", empty — is not an anchor, and is dropped rather than guessed. `total`,
 * when known, clamps out-of-range pages into the document (a deep link past
 * EOF lands on the last page, never nowhere); null total (document not open
 * yet) passes the raw page through for the caller to clamp later.
 */
export function parseReaderSearchParams(search: string, total: number | null = null): ReaderAnchor {
  const params = new URLSearchParams(search);
  const rawPage = params.get("page");
  let page: number | null = null;
  if (rawPage !== null && /^[1-9][0-9]*$/.test(rawPage.trim())) {
    page = Number.parseInt(rawPage.trim(), 10);
    if (total !== null && total > 0) page = Math.min(page, total);
  }
  return { page, section: null, highlight: params.get("hl") === "1" };
}

/**
 * Parse a location.hash into a Markdown section target (AD-8: `#section-id`).
 * The hash arrives percent-encoded (CJK slugs especially) and is decoded here;
 * an absent, empty, or malformed hash ("#", "%E7") is not an anchor and is
 * dropped rather than guessed.
 */
export function parseReaderHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const raw = hash.slice(1);
  if (raw.length === 0) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Build the anchor href for a page locator (citation chips, plan rows): the
 * reader route with a page anchor, plus `hl=1` when the jump should flash its
 * target.
 */
export function readerAnchorHref(materialId: string, page: number, highlight = false): string {
  const params = new URLSearchParams({ page: String(Math.max(1, Math.floor(page))) });
  if (highlight) params.set("hl", "1");
  return `/read/${encodeURIComponent(materialId)}?${params.toString()}`;
}

/**
 * Build the anchor href for a Markdown section locator (citation chips, T5):
 * the reader route with a `#section-id` hash (percent-encoded — section ids
 * slug CJK freely) plus `hl=1` when the jump should flash its target.
 */
export function readerSectionHref(materialId: string, sectionId: string, highlight = false): string {
  const params = new URLSearchParams();
  if (highlight) params.set("hl", "1");
  const query = params.toString();
  return `/read/${encodeURIComponent(materialId)}${query ? `?${query}` : ""}#${encodeURIComponent(sectionId)}`;
}
