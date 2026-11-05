/**
 * The reader's Mastery Marking pure logic (FR-15, epic-15 T3). Two pieces the
 * mounter (ReaderPage) and the presentational surfaces share:
 *
 * - openClaimsBySection: the read returns ALL of a material's claim rows
 *   (history, newest first — unmark sets clearedAt, never deletes), so the
 *   OPEN claims derive client-side (`clearedAt == null`). One open claim per
 *   section is the server's claim law (an open re-claim returns the row
 *   unchanged), but the derivation stays defensive: the FIRST open row in
 *   returned order wins, never a later duplicate.
 * - markingQuickTestScope: the confirm-quiz launcher's dispatch payload — a
 *   section-scoped QuickTestScope built the way the selection bar builds its
 *   material scope. The green is a claim, never evidence: dispatching only
 *   opens the Quick Test takeover; the claim row itself is untouched (AD-14).
 *
 * PDF section ids ride the parse convention `page-${n}` (parse-pdf.ts), so
 * the scope builder routes them to the pdf selection shape — the seam's
 * quickTestSectionId folds both shapes back to the same section id.
 */
import type { SectionMarkingView } from "@/api/views";
import type { QuickTestScope } from "./quick-test-seam";

const PDF_SECTION_PATTERN = /^page-(\d+)$/;

/**
 * The open claim rows, keyed by section id. `undefined` (the read has not
 * landed) yields an empty map — the mounter treats a NOT-landed read as
 * feature-off (no affordance, no green), never as "no claims".
 */
export function openClaimsBySection(rows: SectionMarkingView[] | undefined): Map<string, SectionMarkingView> {
  const open = new Map<string, SectionMarkingView>();
  if (!rows) return open;
  for (const row of rows) {
    if (row.clearedAt != null) continue;
    if (!open.has(row.sectionId)) open.set(row.sectionId, row);
  }
  return open;
}

/** The section-scoped Quick Test dispatch payload for a claimed section id:
 * PDF `page-N` sections become the pdf selection shape, everything else is a
 * markdown slug. `text` stays empty — the launcher scopes by section, not by
 * a captured selection (the flow reads only the section id off the scope). */
export function markingQuickTestScope(materialId: string, sectionId: string): QuickTestScope {
  const page = PDF_SECTION_PATTERN.exec(sectionId);
  return page
    ? { materialId, selection: { kind: "pdf", page: Number(page[1]), text: "" } }
    : { materialId, selection: { kind: "markdown", sectionId, text: "" } };
}
