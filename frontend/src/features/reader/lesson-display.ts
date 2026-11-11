/**
 * The lesson-display pure derivations (epic-36 T2): everything the reader's
 * lesson state renders comes from HERE — the placeholder rows (outline ×
 * sections × the live stream fragment), the top banner state, and the
 * section-end source anchors (label + AD-8 href). Pure so it is densely
 * unit-tested; LessonFlow stays presentational, ReaderPage owns the reads.
 *
 * Server truth discipline (AD-14-flavored): the outline chapters and their
 * statuses ride the generation jsonb verbatim — the client never re-derives
 * a chapter's state from the sections array beyond resolving a READY
 * chapter's text by its chapter id (the server appends the row with the
 * SAME id atomically).
 */
import { readerAnchorHref, readerSectionHref } from "./anchors";
import type { LessonGenerationView, LessonOutlineChapterView, LessonSourceAnchorView, MaterialView } from "@/api/views";
import type { MaterialSection } from "@/domain/entities";

/** The PDF section-id convention (node-state's same contract — page-N). */
const PDF_PAGE_SECTION = /^page-([1-9][0-9]*)$/;

/** One placeholder-card row: pending (gray), generating (live spinner +
 * stream fragment, or a dropped-connection generating status), ready (the
 * prose + its source line). */
export interface LessonRow {
  chapterId: string;
  title: string;
  status: "pending" | "generating" | "ready" | "failed";
  /** READY: the landed section text. GENERATING: the live stream fragment.
   * Otherwise null. */
  text: string | null;
  anchors: LessonSourceAnchorView[];
  /** True only for the chapter currently streaming on THIS connection. */
  streaming: boolean;
}

export function lessonRows(
  generation: LessonGenerationView,
  sections: MaterialSection[],
  stream: { activeSectionId: string | null; streamText: string | null },
): LessonRow[] {
  return generation.outline.map((chapter: LessonOutlineChapterView) => {
    const liveStreaming = stream.activeSectionId === chapter.id;
    if (liveStreaming) {
      return { chapterId: chapter.id, title: chapter.title, status: "generating", text: stream.streamText, anchors: chapter.anchors, streaming: true };
    }
    if (chapter.status === "ready") {
      const section = sections.find((s) => s.id === chapter.id);
      return { chapterId: chapter.id, title: chapter.title, status: "ready", text: section?.text ?? null, anchors: chapter.anchors, streaming: false };
    }
    return { chapterId: chapter.id, title: chapter.title, status: chapter.status, text: null, anchors: chapter.anchors, streaming: false };
  });
}

/** The top banner state (the ticket's two pause copies + the resume posture):
 * live wins while streaming (pause copy never fights the spinner); a
 * pausedKind rides verbatim; pending work without a pause is the explicit
 * 继续 posture; everything ready and no pause renders no banner. */
export function lessonBannerState(
  generation: LessonGenerationView,
  rows: LessonRow[],
  streaming: boolean,
): "live" | "paused-cap" | "paused-provider" | "incomplete" | "complete" {
  if (streaming) return "live";
  if (generation.pausedKind === "cap") return "paused-cap";
  if (generation.pausedKind === "provider") return "paused-provider";
  return rows.some((row) => row.status === "pending" || row.status === "generating" || row.status === "failed")
    ? "incomplete"
    : "complete";
}

/** The ready-section count (the progress chip). */
export function lessonReadyCount(rows: LessonRow[]): number {
  return rows.filter((row) => row.status === "ready").length;
}

/** The source anchor's reader href — the REAL AD-8 builders consumed
 * verbatim (never rebuilt): pdf page-N rides the ?page channel, markdown
 * the #section channel; both carry ?hl=1 (the jump flashes its target). */
export function sourceAnchorHref(anchor: LessonSourceAnchorView): string {
  const page = PDF_PAGE_SECTION.exec(anchor.sectionId);
  if (page) return readerAnchorHref(anchor.materialId, Number(page[1]), true);
  return readerSectionHref(anchor.materialId, anchor.sectionId, true);
}

/** The translate seam the pure composers take (the LanguageContext t's
 * structural shape — NodeStateTranslate's same signature). */
export type LessonDisplayTranslate = (key: string, vars?: Record<string, string | number>) => string;

/** The source line's label (spec story 20): 《材料名》· §title / 第 N 页 —
 * composed through the i18n table (review F5: the format never bypasses it,
 * so the English UI renders English glyphs). A deleted source renders NO
 * line (an honest gap — never a guessed name); an empty section title falls
 * back to the section id (never a dangling §). */
export function sourceAnchorLabel(anchor: LessonSourceAnchorView, sourceMaterials: MaterialView[] | undefined, t: LessonDisplayTranslate): string | null {
  const material = sourceMaterials?.find((m) => m.id === anchor.materialId);
  if (!material) return null;
  const page = PDF_PAGE_SECTION.exec(anchor.sectionId);
  if (page) return t("reader.lessonSourcePage", { title: material.title, n: Number(page[1]) });
  const section = material.sections.find((s) => s.id === anchor.sectionId);
  const label = section && section.title ? section.title : anchor.sectionId;
  return t("reader.lessonSourceSection", { title: material.title, label });
}
