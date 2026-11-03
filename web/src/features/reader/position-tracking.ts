/**
 * Reading-position tracker selectors (FR-10): pure functions turning measured
 * viewport geometry into the current locator, plus the bounded text resolver
 * (AD-4) and locator equality. Extracted pure because jsdom cannot exercise
 * scroll layout (spec testing decisions; prior art: pager.ts) — the flows only
 * measure and feed; all selection math lives here and is densely tested.
 */
import type { Material, ReadingLocator } from "@/domain/entities";

/** One measured page box: page number + top/height in scroll-container content coordinates. */
export interface MeasuredPageRect {
  page: number;
  top: number;
  height: number;
}

/**
 * Most-visible page (FR-10, UX spine visibility-based tracking): the page
 * occupying the largest share of the viewport wins. The tracked page flips
 * exactly at the half-visible boundary between two equal pages — the exact
 * tie keeps the earlier page, so scroll position (not float luck) decides.
 * rects must be in document order; degenerate input (no rects, empty
 * viewport) or nothing visible (overscroll bounce) yields null — the caller
 * holds its previous position.
 */
export function mostVisiblePage(
  rects: MeasuredPageRect[],
  scrollTop: number,
  viewportHeight: number,
): number | null {
  if (rects.length === 0 || viewportHeight <= 0) return null;
  const viewportBottom = scrollTop + viewportHeight;
  let best: number | null = null;
  let bestShare = 0;
  for (const rect of rects) {
    if (rect.height <= 0) continue;
    const visible = Math.min(rect.top + rect.height, viewportBottom) - Math.max(rect.top, scrollTop);
    if (visible <= 0) continue;
    const share = visible / viewportHeight;
    if (share > bestShare || (share === bestShare && best !== null && rect.page < best)) {
      bestShare = share;
      best = rect.page;
    }
  }
  return best;
}

/**
 * The scroll-spy reading line: a heading becomes the current section once its
 * top crosses this offset below the scroll container's top edge. The value
 * matches the headings' scroll margin (scroll-mt-8 = 32px, at every width —
 * one constant both sides read), so a section is current the moment an
 * anchor/restore lands on it — tracking never fights the landing.
 */
export const READING_LINE_OFFSET = 32;

/**
 * Markdown scroll-spy (FR-10): the LAST boundary whose top is at or above the
 * reading line. Between boundaries (the gaps), the earlier section holds;
 * above the first boundary sits the intro region — text before the first
 * heading has no heading element, so it maps to Material.sections[0]'s id
 * (T3's contract), passed as `introId`; null introId → null. An exact
 * boundary hit (top === reading line) already belongs to that section.
 * An empty heading renders id="" (the anchor-agreement seam pins it) — it is
 * unaddressable, so it never becomes the current section: the earlier section
 * holds across it and an all-empty run reads as no section at all.
 */
export function currentSection(
  boundaries: { id: string; top: number }[],
  scrollTop: number,
  introId: string | null = null,
): string | null {
  const line = scrollTop + READING_LINE_OFFSET;
  let current: string | null = null;
  for (const boundary of boundaries) {
    if (boundary.top > line) break;
    if (!boundary.id) continue; // "" is no section — the report must never carry an empty locator
    current = boundary.id;
  }
  return current ?? introId;
}

/**
 * The Material.sections id a locator points at (AD-2): pdf pages are the
 * `page-N` sections the parser extracts; markdown locators carry the section
 * id directly.
 */
export function locatorSectionId(locator: ReadingLocator): string {
  return locator.kind === "pdf" ? `page-${Math.max(1, Math.floor(locator.page))}` : locator.sectionId;
}

/**
 * The position's text (AD-4 quota safety): the bounded extracted section text
 * FROM Material.sections, matched to the locator — never raw bytes, never
 * unbounded document text. A locator with no matching section (failed
 * re-parse, changed slugs) resolves to the empty string honestly.
 */
export function positionText(material: Material | null, locator: ReadingLocator): string {
  if (!material) return "";
  const id = locatorSectionId(locator);
  return material.sections.find((section) => section.id === id)?.text ?? "";
}

/** Locator equality — the tracker's "position actually changed" test. */
export function locatorsEqual(a: ReadingLocator, b: ReadingLocator): boolean {
  if (a.kind === "pdf" && b.kind === "pdf") return a.page === b.page;
  if (a.kind === "markdown" && b.kind === "markdown") return a.sectionId === b.sectionId;
  return false;
}
