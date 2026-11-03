/**
 * Pager math (FR-8; UX interaction primitive ←/→): pure page-list logic for
 * the PDF page flow — clamping, stepping, and the lazy render/release window.
 * Extracted as pure functions because jsdom cannot exercise the canvas they
 * drive (spec testing decisions); PdfPageFlow only wires these to DOM.
 */

/**
 * Clamp a 1-based page into [1, total]. total ≤ 0 (no pages parsed) yields 1
 * so callers never hold an out-of-range current page.
 */
export function clampPage(page: number, total: number): number {
  const safeTotal = Math.max(1, Math.floor(total));
  const safePage = Math.floor(page);
  if (safePage < 1) return 1;
  return Math.min(safePage, safeTotal);
}

/**
 * ←/→ stepping: current + delta, clamped to the document — the step never
 * overshoots the first/last page (UX: paging through a document is comfortable,
 * not an error surface).
 */
export function stepPage(current: number, delta: number, total: number): number {
  return clampPage(Math.floor(current) + delta, total);
}

/**
 * The lazy render window (FR-8): pages within `radius` of the current page
 * render; pages outside it release (their canvas clears, the layout keeps the
 * page's measured height so scroll never jumps). Window clamps to the
 * document edges; radius < 0 collapses to just the current page.
 */
export function renderWindow(
  current: number,
  total: number,
  radius: number,
): { from: number; to: number } {
  const safeTotal = Math.max(0, Math.floor(total));
  if (safeTotal === 0) return { from: 0, to: 0 };
  const safeRadius = Math.max(0, Math.floor(radius));
  const page = clampPage(current, safeTotal);
  return {
    from: clampPage(page - safeRadius, safeTotal),
    to: clampPage(page + safeRadius, safeTotal),
  };
}

/** Whether a page is inside the render window (and therefore holds pixels). */
export function inRenderWindow(page: number, window: { from: number; to: number }): boolean {
  return page >= window.from && page <= window.to;
}
