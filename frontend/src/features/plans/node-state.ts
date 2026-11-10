/**
 * The node-state display contract (epic P2-10 T3; FR-6/7; AD-9 + AD-14) — ONE
 * contract for every node-shaped surface: the PlanHome tree row today, the
 * roadmap graph node (T4) next. Two halves:
 *
 * 1. STATE — glyph + tint class + text label key + aria-label, per SERVER
 *    state ("uncovered" | "partial" | "mastered", Mastery's vocabulary
 *    verbatim; the client renders, never recomputes, AD-14). Never color-only
 *    (AD-9): every state carries a distinct glyph AND text label AND
 *    aria-label. The one renderer is NodeStateBadge (node-state-badge.tsx).
 *
 * 2. CLICK-THROUGH — the study action builds its reader destinations ONLY
 *    through the anchor channel (AD-8: readerSectionHref / readerAnchorHref,
 *    consumed verbatim — never rebuilt here) from a node's CONFIRMED mappings
 *    whose material is parsed and whose section still exists; everything else
 *    falls back to the node Quick Test route (/plan/:planId/quiz?nodeId=<id> —
 *    the plan flow; node-scoped GENERATION lands with T5's node_scope).
 *
 * Pure module (no component exports — react-refresh; the badge is the single
 * renderer in node-state-badge.tsx).
 */
import { readerAnchorHref, readerSectionHref } from "@/features/reader/anchors";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";

/** The SERVER state vocabulary verbatim (Mastery/AD-6/AD-14). */
export type NodeStateVocabulary = "uncovered" | "partial" | "mastered";

/** One state's display contract: distinct glyph + tint + label (AD-9). */
export interface NodeStateDisplay {
  glyph: string;
  tintClass: string;
  labelKey: string;
}

export const NODE_STATE_DISPLAY: Record<NodeStateVocabulary, NodeStateDisplay> = {
  mastered: { glyph: "\u2726", tintClass: "pill pill-mastered", labelKey: "plans.stateMastered" },
  partial: { glyph: "\u25D0", tintClass: "pill pill-partial", labelKey: "plans.statePartial" },
  uncovered: { glyph: "\u25CB", tintClass: "pill pill-muted", labelKey: "plans.stateUncovered" },
};

/**
 * The SVG face of a graph node (epic P2-10 T4): the SAME state tints as the
 * HTML pill classes carry, expressed as CSS-var styles an SVG rect/text can
 * consume (semantic tokens only — never raw palette values, dark mode +
 * palettes stay intact). The graph node face renders glyph + tint from here;
 * the badge keeps rendering the pill classes.
 */
export const NODE_STATE_FACE: Record<NodeStateVocabulary, { fill: string; ink: string }> = {
  mastered: { fill: "hsl(var(--mastered-tint))", ink: "var(--mastered-ink)" },
  partial: { fill: "hsl(var(--partial-tint))", ink: "var(--partial-ink)" },
  uncovered: { fill: "hsl(var(--uncovered-fill))", ink: "hsl(var(--muted-foreground))" },
};

/** The t() shape the contract consumes (LanguageContext's translator). */
export type NodeStateTranslate = (key: string, vars?: Record<string, string | number>) => string;

/** The state's aria-label — distinct per state (the {state} label interpolates). */
export function nodeStateAriaLabel(state: NodeStateVocabulary, t: NodeStateTranslate): string {
  return t("plans.nodeStateAria", { state: t(NODE_STATE_DISPLAY[state].labelKey) });
}

/** One jump destination off a confirmed mapping: the mapped section by title. */
export interface NodeJumpTarget {
  mappingId: string;
  materialId: string;
  sectionId: string;
  /**
   * The section's title; null renders the section id instead (a bare `#`
   * heading has none — never a dangling label).
   */
  title: string | null;
  /** The anchor href, built via the REAL anchor builders (AD-8). */
  href: string;
}

const PDF_PAGE_SECTION = /^page-([1-9][0-9]*)$/;

/**
 * A node's jump targets from its mapping rows: CONFIRMED rows only, resolved
 * against the caller's materials. A row without a parsed material, whose
 * section id drifted out of the extraction (slug drift after a re-parse), or
 * whose pdf section id is off the page-N convention, cannot build an honest
 * anchor and is skipped (the latestReading stale-row precedent) — never a
 * destination the reader cannot land on.
 */
export function nodeJumpTargets(mappings: MaterialNodeMappingView[], materials: MaterialView[]): NodeJumpTarget[] {
  const targets: NodeJumpTarget[] = [];
  for (const row of mappings) {
    if (row.status !== "confirmed") continue;
    const material = materials.find((m) => m.id === row.materialId);
    if (!material || material.parseState !== "parsed") continue;
    const section = material.sections.find((s) => s.id === row.sectionId);
    if (!section) continue;
    if (material.kind === "pdf") {
      const page = PDF_PAGE_SECTION.exec(row.sectionId);
      if (!page) continue;
      targets.push({ mappingId: row.id, materialId: material.id, sectionId: row.sectionId, title: section.title || null, href: readerAnchorHref(material.id, Number(page[1]), true) });
    } else {
      targets.push({ mappingId: row.id, materialId: material.id, sectionId: row.sectionId, title: section.title || null, href: readerSectionHref(material.id, row.sectionId, true) });
    }
  }
  return targets;
}

/** The node Quick Test launch route (the plan flow; T5 completes node scope). */
export function nodeQuickTestHref(planId: string, nodeId: string): string {
  return `/plan/${encodeURIComponent(planId)}/quiz?nodeId=${encodeURIComponent(nodeId)}`;
}

/** The row/node's primary click-through: study at the mapped section, else Quick Test. */
export type NodePrimaryAction =
  | { kind: "study"; targets: NodeJumpTarget[] }
  | { kind: "quiz"; href: string };

export function nodePrimaryAction(targets: NodeJumpTarget[], planId: string, nodeId: string): NodePrimaryAction {
  if (targets.length > 0) return { kind: "study", targets };
  return { kind: "quiz", href: nodeQuickTestHref(planId, nodeId) };
}

/**
 * The ask-AI handoff (epic-28 T4): inject the one-shot companionAsk draft
 * question into a reader href — BEFORE the hash (the anchor channel stays
 * intact), as `&` or `?` per the href's existing query. The reader consumes
 * the param once on mount (prefill WITHOUT send) and strips it.
 */
export function withCompanionAsk(href: string, question: string): string {
  const hashIndex = href.indexOf("#");
  const base = hashIndex < 0 ? href : href.slice(0, hashIndex);
  const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}companionAsk=${encodeURIComponent(question)}${hash}`;
}
