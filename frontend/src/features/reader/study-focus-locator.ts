/**
 * The Study Focus deep-link derivation (FR-17, epic-13 T4; OQ-1): the
 * server-owned sourceRange (the AD-2 annotation range verbatim) → the
 * reader's jump target — the AD-8 anchor channel's locator shape. Owns its
 * own module so the panel file stays component-only (react-refresh).
 */
import type { AnnotationRange } from "@/domain/annotation-range";
import type { ReadingLocator } from "@/domain/entities";

/** The locator the panel's jump fires with (ReaderPage's jumpToLocator —
 * scroll + flash). Null = a range-less source — honestly unlinkable. */
export function focusSourceLocator(range: AnnotationRange): ReadingLocator | null {
  if (range.page != null) return { kind: "pdf", page: range.page };
  if (range.sectionId != null) return { kind: "markdown", sectionId: range.sectionId };
  return null;
}
