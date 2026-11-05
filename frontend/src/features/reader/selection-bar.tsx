/**
 * The reader's floating selection bar (FR-13, epic-13 T1; the UX spine's
 * SelectionBar row): on a text selection inside the reader content (markdown
 * prose or the PDF text layer) it floats two one-click actions beside the
 * selection — 「问 Companion」 (Ask) and 「快测」 (Quick Test).
 *
 * Presence/position/dismissal are the MOUNTER's job (ReaderPage listens to
 * selectionchange/scroll/Escape and hands in the viewport-clamped anchor —
 * selection-capture.ts's pure math); the component is the two REAL buttons
 * (native <button>: focusable, Enter/Space — the a11y floor, AD-9) plus the
 * honest Quick Test seam behavior: with T2's flow registered the scope
 * dispatches through quick-test-seam.ts; without, the toast says the step is
 * coming instead of a dead affordance.
 *
 * T2 (epic-13, FR-14) adds the Quick Test GATE (AD-6's honesty law — a
 * section Quick Test generates evidence only through a confirmed node
 * mapping): the mounter resolves the material's mapping read and hands the
 * gate state in. In-flight renders the action disabled-honestly (no
 * premature clicks); a failed read keeps it disabled under a tooltip; NO
 * confirmed mapping hides the action entirely, leaving the traceable hint
 * line 「关联节点后可快测」 in its place (FR-27's trace-to-gap spirit). Only
 * the landed-and-confirmed state enables the dispatch.
 *
 * T3 (epic-13, FR-16) adds the bar's THIRD action group — the annotation
 * entry (the delta decision: the bar IS the annotate surface): four named
 * highlight color chips + one underline chip, all native buttons (the
 * keyboard path — the list panel is the management surface). A chip click
 * hands (kind, color) to onAnnotate; the MOUNTER re-captures the LIVE
 * selection (the bar's mousedown suppression below keeps it alive through
 * the click), builds the domain range, and persists — the bar knows
 * nothing about offsets. When onAnnotate is absent the group hides (the
 * pre-T3 bar shape, unchanged for T1/T2 consumers and their tests).
 *
 * The container suppresses mousedown's default: pressing a button would
 * otherwise collapse the selection before the click lands — the bar never
 * destroys the thing it acts on, and the selection stays free to be re-made
 * (the bar itself is a small fixed element; the text around it never loses
 * pointer events).
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, ListChecks } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ANNOTATION_COLORS, type AnnotationColor, type AnnotationKind } from "./annotation-engine";
import type { QuickTestGateState } from "./quick-test-gate";
import { dispatchQuickTest } from "./quick-test-seam";
import type { CapturedSelection } from "./selection-capture";

/** The bar's approximate footprint (px) — the mounter's clamp math
 * (selection-capture.ts's barAnchor) positions with these; the CSS keeps the
 * real box within them (two compact buttons + the chip group on one row). */
export const SELECTION_BAR_WIDTH = 344;
export const SELECTION_BAR_HEIGHT = 36;

/** The chips' aria-label keys + tint vars (the named palette keys — the
 * command's closed vocabulary, the engine's render tokens). */
const COLOR_CHIP_ARIA: Record<AnnotationColor, string> = {
  coral: "reader.annotationColorCoralAria",
  amber: "reader.annotationColorAmberAria",
  emerald: "reader.annotationColorEmeraldAria",
  blue: "reader.annotationColorBlueAria",
};
const COLOR_CHIP_TINT: Record<AnnotationColor, string> = {
  coral: "var(--anno-coral)",
  amber: "var(--anno-amber)",
  emerald: "var(--anno-emerald)",
  blue: "var(--anno-blue)",
};

export interface SelectionBarProps {
  /** The captured selection (AD-2 shape + text) the actions act on. */
  selection: CapturedSelection;
  /** The reader's material — the Quick Test scope's target. */
  materialId: string;
  /** Viewport coordinates from selection-capture.ts's barAnchor (clamped). */
  anchor: { x: number; y: number };
  /** Ask: the reader opens the Companion with this selection as grounding. */
  onAsk(selection: CapturedSelection): void;
  /** The bar's own Escape (and any mounter-side dismissal). */
  onDismiss(): void;
  /**
   * The Quick Test gate (T2, epic-13): the mounter's resolved
   * QuickTestGateState from the material's confirmed-mapping read. "ready"
   * enables the dispatch; "loading" (read in flight) and "error" (read
   * failed) keep the action disabled-honestly; "none" hides it behind the
   * traceable hint line. Defaults "ready" — the pre-T2 bar always offered
   * the action and the seam's dispatch honesty owned the rest.
   */
  quickTestGate?: QuickTestGateState;
  /**
   * The annotation entry (T3, epic-13): present → the chip group renders;
   * a click hands (kind, color) — the mounter owns the capture + the
   * persistence. Absent → the group hides (the pre-T3 bar shape).
   */
  onAnnotate?(kind: AnnotationKind, color: AnnotationColor | null): void;
}

export function SelectionBar({ selection, materialId, anchor, onAsk, onDismiss, quickTestGate = "ready", onAnnotate }: SelectionBarProps) {
  const { t } = useLanguage();

  // The bar's keyboard way out (the mounter keeps scroll/collapse dismissal).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const quickTest = () => {
    // The T1 → T2 seam: honest coming-soon toast while no flow is registered,
    // real dispatch once T2 fills the slot (never a dead affordance).
    const dispatched = dispatchQuickTest({ materialId, selection });
    if (!dispatched) toast.info(t("reader.quickTestComingSoon"));
    onDismiss();
  };

  const gateBlocked = quickTestGate === "loading" || quickTestGate === "error";

  return (
    <div
      role="toolbar"
      aria-label={t("reader.selectionBarLabel")}
      // Suppressing the press default keeps the selection alive through the
      // click — without it the browser collapses the selection on mousedown.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-40 flex items-center gap-1 rounded-xl border border-border-soft bg-card shadow-raised p-1 animate-pop"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <button
        type="button"
        onClick={() => onAsk(selection)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--glass-2)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircleQuestion className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
        {t("reader.selectionAsk")}
      </button>
      {quickTestGate === "none" ? (
        // No confirmed mapping (the landed read) — the action hides and the
        // traceable hint takes its place (FR-27's spirit: the gap names
        // itself, bilingual, never a silent disappearance).
        <span
          data-testid="quick-test-gate-hint"
          className="inline-flex items-center px-2.5 py-1.5 text-xs text-muted-foreground"
        >
          {t("reader.quickTestGateHint")}
        </span>
      ) : (
        <button
          type="button"
          data-testid="quick-test-action"
          onClick={quickTest}
          disabled={gateBlocked}
          aria-disabled={gateBlocked}
          title={quickTestGate === "error" ? t("reader.quickTestUnavailable") : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--glass-2)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
        <ListChecks className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
        {t("reader.selectionQuickTest")}
        </button>
      )}
      {onAnnotate && (
        <>
          <span className="w-px h-5 bg-border flex-none" aria-hidden="true" />
          <div role="group" aria-label={t("reader.annotationsPanelTitle")} className="flex items-center gap-1">
            {ANNOTATION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t(COLOR_CHIP_ARIA[color])}
                title={t(COLOR_CHIP_ARIA[color])}
                onClick={() => onAnnotate("highlight", color)}
                className="w-6 h-6 rounded-full border border-border-soft flex-none cursor-pointer hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ background: COLOR_CHIP_TINT[color] }}
              />
            ))}
            <button
              type="button"
              aria-label={t("reader.annotationUnderlineAria")}
              title={t("reader.annotationUnderlineAria")}
              onClick={() => onAnnotate("underline", null)}
              className="w-6 h-6 rounded-md flex-none flex items-center justify-center cursor-pointer hover:bg-[var(--glass-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-xs font-semibold underline decoration-2 underline-offset-2 text-foreground" aria-hidden="true">
                U
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
