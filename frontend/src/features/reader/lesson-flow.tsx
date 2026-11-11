/**
 * The lesson flow (epic-36 T2 — the reader's generated-lesson face): the
 * reader IS the progress face. The outline chapters render as placeholder
 * cards — pending gray, the ACTIVE one streaming (spinner + the live token
 * fragment), ready chapters render their landed prose through the SAME
 * MarkdownView the ordinary reader uses (annotations/claims/confirm-quiz
 * ride the identical pass-through props — a lesson section is a material
 * section, zero special-casing) — and each ready section ends with its
 * SOURCE LINE (《材料名》· §title / 第 N 页) clicking through to the
 * original reader (AD-8 anchor channel, the deep-link half).
 *
 * The top banner (lessonBannerState): live progress while streaming; the
 * cap pause (明日续) and provider pause (两态文案) with 继续生成 (the
 * explicit new ticket — the server's resume semantics fill only the debt);
 * an incomplete, unpaused lesson offers the honest 继续; complete renders
 * no banner. 重新生成 carries the strong confirm (原位替换 + 重烧额度) and
 * dispatches through onRegenerate — the page's hook mints the regenerate
 * ticket. Presentational: every read/state rides props (ReaderPage owns
 * them); lazy-loads MarkdownView so the markdown pipeline keeps its own
 * chunk (AD-8, the MarkdownFlow rule).
 */
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, PauseCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { MaterialView } from "@/api/views";
import {
  lessonBannerState,
  lessonReadyCount,
  sourceAnchorHref,
  sourceAnchorLabel,
  type LessonRow,
} from "./lesson-display";
import type { AnnotationApplyResult, AnnotationRenderItem } from "./annotation-engine";
import type { QuickTestGateState } from "./quick-test-gate";

const MarkdownView = lazy(() => import("./markdown-view"));

interface LessonFlowProps {
  material: MaterialView;
  /** The shaped placeholder rows (lessonRows — the pure module). */
  rows: LessonRow[];
  streaming: boolean;
  activeSectionId: string | null;
  streamText: string | null;
  /** The plan's materials (the anchor labels resolve 《材料名》· §title off
   * them; a deleted source renders the honest gap). */
  sourceMaterials?: MaterialView[];
  onResume(): void;
  onRegenerate(): void;
  // The ordinary-reader pass-throughs (absent = feature off — the same
  // contract MarkdownFlow renders): a ready section IS a material section.
  annotations?: AnnotationRenderItem[];
  introSectionId?: string | null;
  staleTitle?: string;
  onAnnotationsApplied?(results: AnnotationApplyResult[]): void;
  onRemoveAnnotation?(id: string): void;
  claimedSectionIds?: Set<string>;
  onToggleClaim?(sectionId: string): void;
  onConfirmQuiz?(sectionId: string): void;
  quickTestGate?: QuickTestGateState;
}

export default function LessonFlow({
  material,
  rows,
  streaming,
  activeSectionId,
  streamText,
  sourceMaterials,
  onResume,
  onRegenerate,
  annotations,
  introSectionId,
  staleTitle,
  onAnnotationsApplied,
  onRemoveAnnotation,
  claimedSectionIds,
  onToggleClaim,
  onConfirmQuiz,
  quickTestGate,
}: LessonFlowProps) {
  const { t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const generation = material.generation;
  const banner = generation ? lessonBannerState(generation, rows, streaming) : "complete";
  const ready = lessonReadyCount(rows);
  const total = rows.length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-secondary/50">
      {/* 重新生成's strong confirm (the ticket's 二次确认): the in-place
          replace re-burns the budget — never a one-click destroy. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="lesson-regenerate-dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("reader.lessonRegenerateTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-[1.6]">{t("reader.lessonRegenerateBody")}</p>
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              data-testid="lesson-regenerate-cancel"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {t("reader.lessonRegenerateCancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                onRegenerate();
              }}
              data-testid="lesson-regenerate-confirm"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:bg-[var(--accent-tint-2)]"
            >
              {t("reader.lessonRegenerateConfirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="w-full px-4 md:px-8 py-6 md:py-8 flex justify-center">
        <div className="w-full max-w-[70ch] flex flex-col gap-5">
          {banner !== "complete" && (
            <LessonBanner
              banner={banner}
              ready={ready}
              total={total}
              liveTitle={activeSectionId ? (rows.find((row) => row.chapterId === activeSectionId)?.title ?? null) : null}
              onResume={onResume}
              onRegenerate={() => setConfirmOpen(true)}
            />
          )}

          {rows.map((row) => {
            if (row.status === "ready") {
              return (
                <article key={row.chapterId} data-testid="lesson-section-ready" className="reader-prose reader-body bg-card border border-border-soft rounded-2xl shadow-raised px-6 py-5">
                  {row.text === null ? (
                    <Skeleton className="h-4 w-full" />
                  ) : (
                    <>
                      <Suspense fallback={<LessonSkeleton />}>
                        <MarkdownView
                          text={row.text}
                          flashSection={null}
                          annotations={annotations}
                          introSectionId={introSectionId}
                          staleTitle={staleTitle}
                          onAnnotationsApplied={onAnnotationsApplied}
                          onRemoveAnnotation={onRemoveAnnotation}
                          claimedSectionIds={claimedSectionIds}
                          onToggleClaim={onToggleClaim}
                          onConfirmQuiz={onConfirmQuiz}
                          quickTestGate={quickTestGate}
                        />
                      </Suspense>
                      <LessonSourceLine anchors={row.anchors} sourceMaterials={sourceMaterials} />
                    </>
                  )}
                </article>
              );
            }
            const live = row.streaming;
            return (
              <div
                key={row.chapterId}
                data-testid={live ? "lesson-placeholder-active" : "lesson-placeholder"}
                className={cn(
                  "bg-card border rounded-2xl px-6 py-5 flex flex-col gap-2",
                  live ? "border-accent-edge shadow-raised" : "border-border-soft opacity-70",
                )}
                aria-live={live ? "polite" : undefined}
              >
                <div className="flex items-center gap-2">
                  {live ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-ink" aria-hidden="true" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                  )}
                  <span className="text-sm font-semibold">{row.title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {row.status === "failed" ? t("reader.lessonFailedLabel") : live ? t("reader.lessonGeneratingLabel") : t("reader.lessonPendingLabel")}
                  </span>
                </div>
                {live && (
                  <p className="text-sm text-muted-foreground leading-[1.7] whitespace-pre-wrap">{streamText ?? ""}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The top banner: live progress / the two pause copies / the honest
 * incomplete posture — 继续 + 重新生成 always paired when generation can
 * still act. */
function LessonBanner({
  banner,
  ready,
  total,
  liveTitle,
  onResume,
  onRegenerate,
}: {
  banner: "live" | "paused-cap" | "paused-provider" | "incomplete";
  ready: number;
  total: number;
  liveTitle: string | null;
  onResume(): void;
  onRegenerate(): void;
}) {
  const { t } = useLanguage();
  const copy =
    banner === "live"
      ? liveTitle
        ? t("reader.lessonLiveSection", { title: liveTitle })
        : t("reader.lessonLive")
      : banner === "paused-cap"
        ? t("reader.lessonPausedCap")
        : banner === "paused-provider"
          ? t("reader.lessonPausedProvider")
          : t("reader.lessonIncomplete", { n: Math.max(0, total - ready) });

  return (
    <div
      data-testid="lesson-pause-banner"
      className="rounded-2xl border border-border-soft bg-[var(--glass-2)] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <PauseCircle className="w-4 h-4 flex-none text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-medium leading-[1.6]">{copy}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5" aria-label={t("reader.lessonProgressAria", { ready, total })}>
            {t("reader.lessonProgress", { ready, total })}
          </p>
        </div>
      </div>
      {banner !== "live" && (
        <div className="flex items-center gap-3 flex-none">
          <button
            type="button"
            onClick={onResume}
            data-testid="lesson-resume"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
          >
            {t("reader.lessonResume")}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            data-testid="lesson-regenerate"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:underline"
          >
            {t("reader.lessonRegenerate")}
          </button>
        </div>
      )}
    </div>
  );
}

/** One ready section's source line (spec story 20): 《材料名》· §title /
 * 第 N 页 → the original reader (AD-8 deep link with the flash flag). A
 * deleted source renders the honest gap text — never a guessed name. */
function LessonSourceLine({ anchors, sourceMaterials }: { anchors: LessonRow["anchors"]; sourceMaterials?: MaterialView[] }) {
  const { t } = useLanguage();
  if (anchors.length === 0) return null;
  const resolved = anchors
    .map((anchor) => ({ anchor, label: sourceAnchorLabel(anchor, sourceMaterials) }))
    .filter((entry) => entry.label !== null);
  return (
    <div data-testid="lesson-source-line" className="mt-4 pt-3 border-t border-border-soft flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
      <span className="font-medium">{t("reader.lessonSourceLine")}</span>
      {resolved.length === 0 && <span data-testid="lesson-source-missing">{t("reader.lessonSourceMissing")}</span>}
      {resolved.map(({ anchor, label }) => (
        <Link
          key={`${anchor.materialId}-${anchor.sectionId}`}
          to={sourceAnchorHref(anchor)}
          data-testid="lesson-source-link"
          aria-label={t("reader.lessonSourceAria")}
          className="inline-flex items-center gap-0.5 hover:text-accent-ink cursor-pointer"
        >
          {label}
          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

/** Calm line-skeleton while the markdown chunk loads. */
function LessonSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-6 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
    </div>
  );
}
