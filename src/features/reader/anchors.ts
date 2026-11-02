/**
 * Reader anchor params (AD-8): `?page=N` for PDF deep links and the transient
 * `?hl=1` highlight flag — the ONLY cross-feature command channel into the
 * reader, reused internally by citation chips (T5). Pure parsing so deep links
 * are testable without a router; callers clamp against the real page count
 * once the document is open (see pager.clampPage).
 */

/** What an anchor query string asks the reader to do. */
export interface ReaderAnchor {
  /** 1-based PDF page target; null when the link carries no page anchor (or an unusable one). */
  page: number | null;
  /** The transient `?hl=1` flag — flash the target in the citation tint, once. */
  highlight: boolean;
}

/**
 * Parse a location.search into a ReaderAnchor. `page` accepts positive
 * integers only ("3" → 3); anything else — "0", "-2", "3.5", "abc", empty —
 * is not an anchor, and is dropped rather than guessed. `total`, when known,
 * clamps out-of-range pages into the document (a deep link past EOF lands on
 * the last page, never nowhere); null total (document not open yet) passes the
 * raw page through for the caller to clamp later.
 */
export function parseReaderSearchParams(search: string, total: number | null = null): ReaderAnchor {
  const params = new URLSearchParams(search);
  const rawPage = params.get("page");
  let page: number | null = null;
  if (rawPage !== null && /^[1-9][0-9]*$/.test(rawPage.trim())) {
    page = Number.parseInt(rawPage.trim(), 10);
    if (total !== null && total > 0) page = Math.min(page, total);
  }
  return { page, highlight: params.get("hl") === "1" };
}

/**
 * Build the anchor href for a locator (citation chips, plan rows): the reader
 * route with a page anchor, plus `hl=1` when the jump should flash its target.
 * Markdown locators anchor by section id and are T3's branch — page locators
 * are the only one this epic renders so far.
 */
export function readerAnchorHref(materialId: string, page: number, highlight = false): string {
  const params = new URLSearchParams({ page: String(Math.max(1, Math.floor(page))) });
  if (highlight) params.set("hl", "1");
  return `/read/${encodeURIComponent(materialId)}?${params.toString()}`;
}
