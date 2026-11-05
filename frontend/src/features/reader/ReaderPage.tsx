/**
 * The Immersive Reader route (FR-8; AD-8): `/read/:materialId`, lazy-loaded
 * under AppLayout. Reading is sacred — maximal area, minimal chrome: a slim
 * top bar (back link, title, page pager, panel-collapse + immersive toggles)
 * over the material zone, with the page-aware Companion positioned by the
 * responsive ladder (T6; UX responsive rows): ≥1024px docked right (400px,
 * 420px ≥1280px) collapsible to a rail; 768–1023px a right slide-over above a
 * scrim; <768px a bottom sheet at ~65dvh. All three mount the SAME
 * CompanionPanel — only the container changes (companion-surfaces.tsx).
 *
 * Parse states land here exactly as the UX spine specifies: parsing →
 * page-skeleton + progress copy; failed → card with the bilingual reason and
 * a retry while the session bytes exist (T1's parse mutation); parsed-but-
 * byteless (post-reload) → the row's presigned downloadUrl restores the
 * server copy (epic P2-6); with no copy to restore, the re-upload affordance
 * re-registers bytes and re-runs the parse. An unknown material reads honestly
 * as not-found.
 *
 * Reading position (FR-10; T4): the flows report the most-visible PDF page /
 * scroll-spy'd Markdown section here; the tracker hook (use-reading-position)
 * debounces persistence through the existing ReadingProgress mutation and
 * flushes on unmount. On open, an anchor (?page=N / #section-id) wins over
 * the stored position; with no anchor the stored page/section restores.
 *
 * Companion wiring (FR-11/12; T5): the tracker's currentPositionRef is the
 * panel's send-time grounding source; a reactive displayLocator mirrors it
 * for the grounded badge and send gating. Citation-chip jumps are the AD-8
 * anchor channel's in-reader half — the flow handles scroll AND flash.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Highlighter,
  ListChecks,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useViewportTier } from "@/hooks/use-mobile";
import {
  apiErrorCode,
  apiErrorKeys,
  newClientUuid,
  useAddAnnotationMutation,
  useAnnotationsQuery,
  useGenerateStudyFocusMutation,
  useMaterialNodeMappingsQuery,
  useMaterialQuery,
  usePlanQuery,
  useReadingProgressQuery,
  useRemoveAnnotationMutation,
  useStudyFocusQuery,
} from "@/api";
import type { ErrorLike } from "@apollo/client";
import { sessionBlobs } from "@/lib/session-blobs";
import { CompanionPanel, type AskPrefill } from "@/features/companion/CompanionPanel";
import { CompanionOverlay, CompanionSheet } from "./companion-surfaces";
import { cn } from "@/lib/utils";
import type { Annotation, ReadingLocator } from "@/domain/entities";
import { PARSE_REASON_MESSAGE_KEY } from "./parse";
import { parseReaderHash, parseReaderSearchParams, type ReaderAnchor } from "./anchors";
import { currentSection } from "./position-tracking";
import { MarkdownFlow, type MarkdownFlowHandle } from "./MarkdownFlow";
import { PdfPageFlow, type PdfFlowHandle } from "./PdfPageFlow";
import { useParseMaterialMutation } from "./use-parse-material";
import { useReadingPositionTracker } from "./use-reading-position";
import { useSessionBytes } from "./use-session-bytes";
import { stepPage } from "./pager";
import { isPptxReupload, validateReupload } from "./reupload";
import { QuickTestFlow } from "./quick-test-flow";
import { quickTestGate } from "./quick-test-gate";
import { SelectionBar, SELECTION_BAR_HEIGHT, SELECTION_BAR_WIDTH } from "./selection-bar";
import { barAnchor, captureSelection, MAX_SELECTION_CHARS, type CapturedSelection } from "./selection-capture";
import {
  ANNOTATION_COLORS,
  buildRangeFromCapture,
  type AnnotationApplyResult,
  type AnnotationApplyStatus,
  type AnnotationColor,
  type AnnotationKind,
  type AnnotationRenderItem,
} from "./annotation-engine";
import { AnnotationsPanel } from "./annotations-panel";
import { StudyFocusPanel } from "./study-focus-panel";

// The study-focus generation toasts ride the closed-enum map's shared
// `ai.generate.` namespace (the server adapter's sibling keys — capReached
// included); anything unmapped falls to the panel's own honest failure key.
const FOCUS_ERROR_KEYS: Record<string, string> = apiErrorKeys("ai.generate.");
const FOCUS_FAILED_KEY = "reader.studyFocusGenerateFailed";

export default function ReaderPage() {
  const { materialId } = useParams();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const materialQuery = useMaterialQuery(materialId ?? "");
  const planQuery = usePlanQuery(materialQuery.data?.planId ?? "");
  const hasBytes = useSessionBytes(materialId ?? "");
  const material = materialQuery.data;
  const parseMaterial = useParseMaterialMutation(material);

  // The Quick Test gate (FR-14, epic-13 T2; AD-6): the material's confirmed-
  // mapping read decides the selection bar's 快测 posture (in-flight →
  // disabled-honestly, failed → disabled + tooltip, none confirmed → hidden
  // behind the traceable hint, ready → dispatch). QuickTestFlow mounts the
  // same read (Apollo dedupes) and owns the session takeover.
  const mappingsQuery = useMaterialNodeMappingsQuery(materialId ?? "");
  const quickTestGateState = quickTestGate(mappingsQuery.data, mappingsQuery.error);

  // The annotations surface (FR-16, epic-13 T3): the per-material read feeds
  // both render halves (the flows' engine passes) and the list panel; the
  // writes ride the read-back sweeps — the fresh list is the render truth
  // and the persistence round-trip (reload re-applies from the server rows).
  const annotationsQuery = useAnnotationsQuery(materialId ?? "");
  const [addAnnotationMutation] = useAddAnnotationMutation();
  const [removeAnnotationMutation] = useRemoveAnnotationMutation();
  const [annotationsPanelOpen, setAnnotationsPanelOpen] = useState(false);
  // Each engine application reports per-annotation statuses (ok / stale /
  // missing / deferred) — the list panel's honesty badges ride these.
  const [annotationStatuses, setAnnotationStatuses] = useState<Record<string, AnnotationApplyStatus>>({});

  // The Study Focus surface (FR-17, epic-13 T4; OQ-1): the reader-side
  // 「核心要点」panel, toggled from the toolbar (the delta-grill ruling).
  // The two left cards are mutually exclusive (same spot, same layer) —
  // opening one closes the other.
  const studyFocusQuery = useStudyFocusQuery(materialId ?? "");
  const [generateStudyFocusMutation, generateStudyFocusResult] = useGenerateStudyFocusMutation();
  const [focusPanelOpen, setFocusPanelOpen] = useState(false);
  const handleGenerateStudyFocus = useCallback(() => {
    if (!material) return;
    void generateStudyFocusMutation({
      variables: { input: { clientUuid: newClientUuid(), language, materialId: material.id } },
      onError: (error) => {
        const code = apiErrorCode(error as ErrorLike);
        toast.error(t(code ? (FOCUS_ERROR_KEYS[code] ?? FOCUS_FAILED_KEY) : FOCUS_FAILED_KEY));
      },
    });
  }, [material, generateStudyFocusMutation, language, t]);

  const [panelChoice, setPanelChoice] = useState<boolean | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const flowRef = useRef<PdfFlowHandle | null>(null);
  // Markdown flow handle — T4 measures section boundaries through it, T5's
  // citation chips scroll through it.
  const mdFlowRef = useRef<MarkdownFlowHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The anchor parses ONCE on mount — the flags below must not move mid-read.
  // ?page=N / ?hl=1 come from the search; #section-id (the Markdown branch of
  // the channel) from the hash. ?hl=1 is transient and stripped below;
  // ?page=N STAYS in the URL deliberately (T4 decision): it is the non-
  // transient half of the anchor channel (AD-8), so a refresh or re-share
  // re-lands on the anchored page — anchors win over stored progress, and
  // once the reader moves, tracking persists normally.
  const location = useLocation();
  const anchorRef = useRef<ReaderAnchor | null>(null);
  if (anchorRef.current === null) {
    anchorRef.current = {
      ...parseReaderSearchParams(searchParams.toString()),
      section: parseReaderHash(location.hash),
    };
  }
  const anchor = anchorRef.current;

  // ?hl=1 is transient (AD-8): the flag is consumed into the anchor above, so
  // the URL drops it immediately — a refresh never re-flashes.
  useEffect(() => {
    if (searchParams.has("hl")) {
      const next = new URLSearchParams(searchParams);
      next.delete("hl");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Responsive ladder (T6): which Companion surface this width mounts — the
  // CSS-gated dock (≥1024), the slide-over (768–1023) or the sheet (<768).
  // A null choice follows the tier default: desktop opens the dock, tablet/
  // mobile keep the reading primary (overlay/sheet closed until asked for).
  const tier = useViewportTier();
  const panelOpen = panelChoice ?? tier === "desktop";

  // A11y floor: Esc closes the topmost reader layer — the selection bar first
  // (it owns its own Escape dismissal below), then the study-focus /
  // annotations list panels (mutually exclusive left cards), then the
  // floating Companion (overlay/sheet; they cover the reading), then
  // immersive exit. The docked panel and rail are not layers (they never
  // cover the reading) and are left alone.
  const [selectionBar, setSelectionBar] = useState<{ captured: CapturedSelection; anchor: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectionBar) return; // the bar's own listener dismisses it this press
      if (focusPanelOpen) {
        setFocusPanelOpen(false);
        return;
      }
      if (annotationsPanelOpen) {
        setAnnotationsPanelOpen(false);
        return;
      }
      const floating = tier === "tablet" || tier === "mobile";
      if (floating && panelOpen) setPanelChoice(false);
      else if (immersive) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tier, panelOpen, immersive, selectionBar, annotationsPanelOpen, focusPanelOpen]);

  // Stored progress (FR-10): the restore target when no anchor asks for one.
  // The flows mount only once this query has settled (gate below), so the
  // initial page/section is known before either flow's one-shot landing runs.
  const progressQuery = useReadingProgressQuery(materialId ?? "");
  const stored = progressQuery.data;
  const storedPdfPage =
    material?.kind === "pdf" && stored?.position.locator.kind === "pdf"
      ? stored.position.locator.page
      : null;
  const storedSectionId =
    material?.kind === "markdown" && stored?.position.locator.kind === "markdown"
      ? stored.position.locator.sectionId
      : null;

  // The position tracker (FR-10): flows report page/section changes here; the
  // hook debounces persistence and flushes on unmount. T5 surface: the
  // CompanionPanel grounds on `currentPositionRef.current` (ReadingPosition |
  // null — locator + bounded extracted text), read at chat time.
  const { report: reportPosition, currentPositionRef } = useReadingPositionTracker(
    materialId ?? "",
    material ?? null,
  );

  // Reactive mirror of the tracked position for DISPLAY (the Companion's
  // grounded badge + send gating); the tracker ref above stays the send-time
  // grounding source. Same report handlers feed both, so they never disagree.
  const [displayLocator, setDisplayLocator] = useState<ReadingLocator | null>(null);

  // Markdown scroll-spy inputs: the rendered heading ids (to detect the intro
  // section — it has no heading element, per T3) feed the pure selector with
  // each viewport report. Reports before the headings resolve are ignored —
  // boundaries don't exist yet and sections[0] would mislabel as the intro.
  // The resolved intro id is STATE (not just a ref) — the annotation engine's
  // intro contract (FR-16) needs it as a reactive prop into the flow.
  const resolvedHeadingIdsRef = useRef<string[]>([]);
  const headingsResolvedRef = useRef(false);
  const [introSectionId, setIntroSectionId] = useState<string | null>(null);
  const handleHeadingsResolved = useCallback((ids: string[]) => {
    resolvedHeadingIdsRef.current = ids;
    headingsResolvedRef.current = true;
    const first = materialRef.current?.kind === "markdown" ? materialRef.current.sections[0] : undefined;
    setIntroSectionId(first && !ids.includes(first.id) ? first.id : null);
  }, []);
  const materialRef = useRef(material);
  useEffect(() => {
    materialRef.current = material;
  }, [material]);
  const handleMarkdownViewport = useCallback(
    (scrollTop: number) => {
      const current = materialRef.current;
      if (!current || !headingsResolvedRef.current) return;
      const boundaries = mdFlowRef.current?.measureBoundaries() ?? [];
      const first = current.sections[0];
      const introId = first && !resolvedHeadingIdsRef.current.includes(first.id) ? first.id : null;
      const sectionId = currentSection(boundaries, scrollTop, introId);
      if (sectionId) {
        reportPosition({ kind: "markdown", sectionId });
        setDisplayLocator((prev) =>
          prev?.kind === "markdown" && prev.sectionId === sectionId ? prev : { kind: "markdown", sectionId },
        );
      }
    },
    [reportPosition],
  );

  // Stable reports from the PDF flow → top-bar pager + position tracker.
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      reportPosition({ kind: "pdf", page });
      setDisplayLocator((prev) => (prev?.kind === "pdf" && prev.page === page ? prev : { kind: "pdf", page }));
    },
    [reportPosition],
  );
  const handleTotalPages = useCallback((total: number) => setTotalPages(total), []);

  // Selection shortcuts (FR-13, epic-13 T1): a text selection inside the
  // reader content (markdown prose or the PDF text layer) floats the
  // 「问 Companion / 快测」 bar beside itself — selection-capture.ts maps the
  // DOM Selection to the AD-2 shape (clamped to the anchor-side section/page;
  // whitespace/collapsed selections never trigger), barAnchor clamps the
  // position into the viewport. Dismissal: any scroll (capture — the flows'
  // inner containers included), a viewport resize, collapse, or Escape (the
  // bar's own listener + the guard in the layer handler above). Ask hands the
  // quote to the Companion (composer pre-fill + the pending-selection ref the
  // next send consumes); Quick Test dispatches through the feature-flag seam
  // (quick-test-seam.ts — T2 fills the registration; until then the bar
  // toasts the honest coming-soon copy itself).
  const materialZoneRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<string | null>(null);
  const [askPrefill, setAskPrefill] = useState<AskPrefill | null>(null);
  useEffect(() => {
    const evaluate = () => {
      const zone = materialZoneRef.current;
      const selection = window.getSelection();
      if (!zone || !selection || selection.rangeCount === 0) return;
      const current = materialRef.current;
      const first = current?.kind === "markdown" ? current.sections[0] : undefined;
      const introId =
        first && headingsResolvedRef.current && !resolvedHeadingIdsRef.current.includes(first.id)
          ? first.id
          : null;
      const captured = captureSelection(selection, { root: zone, introSectionId: introId });
      if (!captured) {
        setSelectionBar(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectionBar({
        captured,
        anchor: barAnchor(rect, window.innerWidth, window.innerHeight, SELECTION_BAR_WIDTH, SELECTION_BAR_HEIGHT),
      });
    };
    const clear = () => setSelectionBar(null);
    let raf = 0;
    const onSelectionChange = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        evaluate();
      });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const handleBarDismiss = useCallback(() => setSelectionBar(null), []);

  const handleBarAsk = useCallback((captured: CapturedSelection) => {
    // The quote rides the ticket bounded (the composer shows the FULL quote —
    // honest display; the wire bound mirrors the server's question discipline).
    pendingSelectionRef.current = captured.text.slice(0, MAX_SELECTION_CHARS);
    setAskPrefill({ quote: captured.text, nonce: Date.now() });
    setSelectionBar(null);
    setPanelChoice(true); // the Companion opens wherever the ladder puts it
  }, []);

  // ── Annotations (FR-16, epic-13 T3) ────────────────────────────────────
  // The render items the flows paint (memoized — the engine re-applies when
  // this array changes identity, never per render).
  const annotationItems = useMemo<AnnotationRenderItem[]>(
    () =>
      (annotationsQuery.data ?? []).map((row) => ({
        id: row.id,
        range: row.range,
        kind: row.kind,
        color: (ANNOTATION_COLORS as readonly string[]).includes(row.color ?? "") ? (row.color as AnnotationColor) : null,
        body: row.body,
      })),
    [annotationsQuery.data],
  );

  const handleAnnotationsApplied = useCallback((results: AnnotationApplyResult[]) => {
    if (results.length === 0) return;
    setAnnotationStatuses((prev) => {
      const next = { ...prev };
      for (const result of results) next[result.id] = result.status;
      return next;
    });
  }, []);

  // The chips' handler: re-capture the LIVE selection (the bar kept it
  // alive through the click — the mousedown suppression), build the AD-2
  // range through the engine's capture seam, and persist. The read-back
  // sweep re-applies; the bar closes (the selection's job is done).
  const handleAnnotate = useCallback(
    (kind: AnnotationKind, color: AnnotationColor | null) => {
      const zone = materialZoneRef.current;
      const selection = window.getSelection();
      const current = materialRef.current;
      if (!zone || !selection || selection.rangeCount === 0 || !current) return;
      const first = current.kind === "markdown" ? current.sections[0] : undefined;
      const introId =
        first && headingsResolvedRef.current && !resolvedHeadingIdsRef.current.includes(first.id) ? first.id : null;
      const captured = captureSelection(selection, { root: zone, introSectionId: introId });
      setSelectionBar(null);
      if (!captured) return;
      const domRange = selection.getRangeAt(0);
      const range = buildRangeFromCapture(zone, domRange, captured, introId);
      if (!range) return;
      const locatorInput =
        captured.kind === "pdf" ? { kind: "pdf", page: captured.page } : { kind: "markdown", sectionId: captured.sectionId };
      const rangeInput =
        captured.kind === "pdf"
          ? { page: range.page, start: range.start, end: range.end, quote: range.quote }
          : { sectionId: range.sectionId, start: range.start, end: range.end, quote: range.quote };
      void addAnnotationMutation({
        variables: {
          input: { materialId: current.id, locator: locatorInput, range: rangeInput, kind, color: color ?? undefined, body: "" },
        },
        onError: () => toast.error(t("reader.annotationAddFailed")),
      });
    },
    [addAnnotationMutation, t],
  );

  const handleRemoveAnnotation = useCallback(
    (id: string) => {
      void removeAnnotationMutation({
        variables: { id },
        onError: () => toast.error(t("reader.annotationRemoveFailed")),
      });
    },
    [removeAnnotationMutation, t],
  );

  // Citation-chip jumps (AD-8, in-reader half): scroll the flow to the cited
  // page/section AND flash it in the citation tint — the same channel external
  // deep links use, without a route change.
  const jumpToLocator = useCallback((locator: ReadingLocator) => {
    if (locator.kind === "pdf") flowRef.current?.scrollToPage(locator.page, true);
    else mdFlowRef.current?.scrollToSection(locator.sectionId, true);
  }, []);

  // The list panel's click-to-scroll — the AD-8 anchor channel's in-reader
  // half, exactly like the citation chips.
  const handleJumpAnnotation = useCallback(
    (annotation: Annotation) => {
      jumpToLocator(annotation.locator);
    },
    [jumpToLocator],
  );

  // Post-reload byte restore (epic P2-6): session bytes are gone after a
  // reload, but the row carries a presigned downloadUrl — fetch the server
  // copy ONCE per material into the session registry, so the render paths, the
  // self-heal parse, and the failed-card retry all keep reading through
  // sessionBlobs unchanged. A failed or missing copy stays honest (the
  // re-upload contract remains on screen).
  const bytesRestoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!material || !material.downloadUrl) return;
    if (sessionBlobs.has(material.id)) return;
    if (bytesRestoredForRef.current === material.id) return; // once — never a retry loop
    bytesRestoredForRef.current = material.id;
    void (async () => {
      try {
        const response = await fetch(material.downloadUrl);
        if (response.ok) sessionBlobs.put(material.id, await response.blob());
      } catch {
        // network failure — the re-upload contract stays honest
      }
    })();
  }, [material]);

  // A deep link into a still-pending material self-heals: with session bytes
  // present the reader can run the same eager parse the attach flow runs.
  const parseState = material?.parseState;
  useEffect(() => {
    if (materialId && parseState === "pending" && sessionBlobs.has(materialId)) {
      parseMaterial.mutate(materialId);
    }
    // The mutation is a stable hook contract (same shape as Plan Home's usage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, parseState, hasBytes]);

  // Re-upload (FR-29 relaxed; the epic-2 contract): fresh session bytes for the
  // SAME material — metadata and extracted sections stay the row's truth — and
  // a pending/failed material re-runs the parse right away.
  const handleReuploadFile = (file: File) => {
    if (!material) return;
    const verdict = validateReupload(file, material.kind);
    // `in`-narrowing (Plan Home's verdict pattern — strictNullChecks is off,
    // so boolean-discriminant narrowing does not apply).
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    // epic-13 T5: the deck's re-upload re-parses client-side — the limitation
    // note rides along, same as at attach time.
    if (isPptxReupload(file)) toast.info(t("reader.pptxTextOnlyNote"));
    sessionBlobs.put(material.id, file);
    if (material.parseState === "pending" || material.parseState === "failed") {
      parseMaterial.mutate(material.id);
    }
  };

  if (materialQuery.loading) return null;

  if (!material) {
    // Honest not-found (AD-8): an unknown or deleted id never pretends.
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
            <button
              type="button"
              onClick={() => navigate("/plans")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("plans.backToPlans")}
            </button>
            <p className="page-title mt-6 text-lg">{t("errors.materialNotFound")}</p>
            <p className="text-xs text-muted-foreground mt-2">{t("reader.notFoundBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  const pagerVisible = totalPages !== null;
  const step = (delta: number) => {
    if (totalPages === null) return;
    flowRef.current?.scrollToPage(stepPage(currentPage, delta, totalPages));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept={
          material.kind === "pdf"
            ? ".pdf,application/pdf"
            : ".md,.markdown,.pptx,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        }
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReuploadFile(file);
          e.target.value = "";
        }}
      />

      {!immersive && (
        <header className="flex-none flex items-center gap-3 min-h-[52px] px-4 md:px-5 bg-card border-b border-border-soft">
          <button
            type="button"
            onClick={() => navigate(material.planId ? `/plan/${material.planId}` : "/plans")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex-none min-w-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="truncate max-w-[180px]">
              {material.planId ? (planQuery.data?.plan.topic ?? t("reader.backToPlan")) : t("plans.backToPlans")}
            </span>
          </button>
          <span className="text-sm font-semibold truncate min-w-0 flex-1" title={material.title}>
            {material.title}
          </span>

          <div className="flex items-center gap-2 flex-none">
            {pagerVisible && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t("reader.prevPageAria")}
                  disabled={currentPage <= 1}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="font-display font-semibold tabular-nums text-[13px]" aria-live="polite">
                  {t("reader.pager", { n: currentPage, m: totalPages ?? 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t("reader.nextPageAria")}
                  disabled={totalPages !== null && currentPage >= totalPages}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="w-px h-4 bg-border" aria-hidden="true" />
              </>
            )}
            <IconToggle
              label={t("reader.studyFocusPanelOpenAria")}
              onClick={() => {
                setFocusPanelOpen((open) => !open);
                setAnnotationsPanelOpen(false);
              }}
            >
              <ListChecks className="w-4 h-4" />
            </IconToggle>
            <IconToggle
              label={t("reader.annotationsPanelOpenAria")}
              onClick={() => {
                setAnnotationsPanelOpen((open) => !open);
                setFocusPanelOpen(false);
              }}
            >
              <Highlighter className="w-4 h-4" />
            </IconToggle>
            <IconToggle
              label={panelOpen ? t("reader.panelCollapseAria") : t("reader.panelExpandAria")}
              onClick={() => setPanelChoice(!panelOpen)}
            >
              {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </IconToggle>
            <IconToggle
              label={t("reader.immersiveOnAria")}
              onClick={() => setImmersive(true)}
            >
              <Maximize2 className="w-4 h-4" />
            </IconToggle>
          </div>
        </header>
      )}

      {/* `relative` scopes the floating ladder surfaces (overlay/sheet) to the
          row UNDER the top bar — the toggle that opens them stays clickable
          above them, and the app's own chrome stays untouched. This zone is
          also the selection capture's root (FR-13): the bar floats over it. */}
      <div ref={materialZoneRef} className="relative flex flex-1 min-h-0">
        {/* material zone */}
        <div className="flex-1 min-w-0 flex flex-col">
          {parseState === "parsing" ? (
            <ParsingSkeleton />
          ) : parseState === "failed" ? (
            <ParseFailedCard
              materialId={material.id}
              reasonKey={PARSE_REASON_MESSAGE_KEY[material.parseFailureReason ?? "unknown"]}
              hasBytes={hasBytes}
              onRetry={(id) => parseMaterial.mutate(id)}
              onReupload={() => fileInputRef.current?.click()}
            />
          ) : parseState === "pending" ? (
            // Bytes present → the self-heal parse above is about to flip this
            // to parsing (skeleton); bytes gone → the re-upload contract.
            hasBytes ? (
              <ParsingSkeleton />
            ) : (
              <ReuploadCard onReupload={() => fileInputRef.current?.click()} />
            )
          ) : material.kind === "markdown" ? (
            // Markdown branch (FR-9): the full document from the session
            // bytes; the byteless post-reload contract is the re-upload card,
            // exactly like the PDF branch. Restore (FR-10): the anchor
            // (#section-id) wins over the stored section when present; the
            // mount gate below guarantees the stored value is known first.
            hasBytes ? (
              progressQuery.loading ? null : (
                <MarkdownFlow
                  ref={mdFlowRef}
                  blob={sessionBlobs.get(material.id)}
                  initialSection={anchor.section ?? storedSectionId}
                  flashTarget={anchor.highlight}
                  onHeadingsResolved={handleHeadingsResolved}
                  onViewportScroll={handleMarkdownViewport}
                  annotations={annotationItems}
                  introSectionId={introSectionId}
                  staleTitle={t("reader.annotationStale")}
                  onAnnotationsApplied={handleAnnotationsApplied}
                />
              )
            ) : (
              <ReuploadCard onReupload={() => fileInputRef.current?.click()} />
            )
          ) : hasBytes ? (
            progressQuery.loading ? null : (
              // Restore (FR-10): the anchor (?page=N) wins over the stored
              // page when present; both are clamped by the flow on landing.
              <PdfPageFlow
                ref={flowRef}
                blob={sessionBlobs.get(material.id)}
                initialPage={anchor.page ?? storedPdfPage}
                flashTarget={anchor.highlight}
                onPageChange={handlePageChange}
                onTotalPages={handleTotalPages}
                annotations={annotationItems}
                onAnnotationsApplied={handleAnnotationsApplied}
              />
            )
          ) : (
            <ReuploadCard onReupload={() => fileInputRef.current?.click()} />
          )}
        </div>

        {/* Companion side, desktop ≥1024px (FR-11/12; T5): the docked panel at
            400px (420px ≥1280px), collapsible to the rail beside it. The panel
            stays mounted while collapsed (display-none) so an in-flight reply
            finishes and persists. Tablet/mobile widths take the overlay/sheet
            surfaces below (T6's ladder) — same panel, different container. */}
        {!immersive && (
          <>
            <aside
              aria-label={t("companion.title")}
              className={cn(
                "w-[400px] xl:w-[420px] flex-none border-l border-border-soft bg-card flex-col min-h-0",
                panelOpen ? "hidden lg:flex" : "hidden",
              )}
            >
              <CompanionPanel
                materialId={material.id}
                material={material}
                positionRef={currentPositionRef}
                displayLocator={displayLocator}
                onJumpToLocator={jumpToLocator}
                selectionRef={pendingSelectionRef}
                askPrefill={askPrefill}
              />
            </aside>
            {panelOpen ? null : (
              <div className="hidden lg:flex w-10 flex-none border-l border-border-soft flex-col items-center pt-3">
                <IconToggle label={t("reader.panelExpandAria")} onClick={() => setPanelChoice(true)}>
                  <PanelRightOpen className="w-4 h-4" />
                </IconToggle>
              </div>
            )}
          </>
        )}

        {/* Ladder, tablet 768–1023px: the Companion as a right slide-over above
            the reading (scrim tap / Esc / the top-bar toggle dismiss). */}
        {!immersive && tier === "tablet" && panelOpen && (
          <CompanionOverlay label={t("companion.title")} onClose={() => setPanelChoice(false)}>
            <CompanionPanel
              materialId={material.id}
              material={material}
              positionRef={currentPositionRef}
              displayLocator={displayLocator}
              onJumpToLocator={jumpToLocator}
              selectionRef={pendingSelectionRef}
              askPrefill={askPrefill}
            />
          </CompanionOverlay>
        )}

        {/* Ladder, mobile <768px: full-bleed reading with the Companion as a
            bottom sheet (~65dvh, drag handle + swipe-to-dismiss). */}
        {!immersive && tier === "mobile" && panelOpen && (
          <CompanionSheet
            label={t("companion.title")}
            closeLabel={t("reader.companionCloseAria")}
            onClose={() => setPanelChoice(false)}
          >
            <CompanionPanel
              materialId={material.id}
              material={material}
              positionRef={currentPositionRef}
              displayLocator={displayLocator}
              onJumpToLocator={jumpToLocator}
              selectionRef={pendingSelectionRef}
              askPrefill={askPrefill}
            />
          </CompanionSheet>
        )}

        {/* The selection shortcuts bar (FR-13): floats beside the live
            selection, viewport-clamped; gone on scroll/collapse/Escape. The
            快测 action carries the Quick Test gate (T2, AD-6): only a landed
            mapping read with ≥1 confirmed row enables the dispatch. T3's
            third group — the annotation chips (FR-16) — rides onAnnotate:
            the handler re-captures the live selection, builds the AD-2
            range, and persists. */}
        {selectionBar && (
          <SelectionBar
            selection={selectionBar.captured}
            materialId={material.id}
            anchor={selectionBar.anchor}
            onAsk={handleBarAsk}
            onDismiss={handleBarDismiss}
            quickTestGate={quickTestGateState}
            onAnnotate={handleAnnotate}
          />
        )}

        {/* The annotations list panel (FR-16, T3): the management + keyboard
            surface — per-row jump (the anchor channel) + delete, stale/
            missing honesty textually. Rendered only over a parsed material
            (the zone's state cards never sit under it). */}
        {annotationsPanelOpen && parseState === "parsed" && (
          <AnnotationsPanel
            materialId={material.id}
            rows={(annotationsQuery.data ?? []).map((annotation) => ({
              annotation,
              status: annotationStatuses[annotation.id] ?? "ok",
            }))}
            onJump={handleJumpAnnotation}
            onRemove={handleRemoveAnnotation}
            onClose={() => setAnnotationsPanelOpen(false)}
          />
        )}

        {/* The Study Focus panel (FR-17, T4; OQ-1): the toolbar-toggled
            「核心要点」card — items deep-link through the anchor channel
            (scroll + flash, the citation chips' channel), the regenerate
            action replaces the active set (the vN chip reads the refetched
            row), and the empty states stay honest (no annotations vs no
            set). Rendered only over a parsed material, like the
            annotations card beside which it lives. */}
        {focusPanelOpen && parseState === "parsed" && (
          <StudyFocusPanel
            materialId={material.id}
            hasAnnotations={
              annotationsQuery.data === undefined ? undefined : (annotationsQuery.data ?? []).length > 0
            }
            set={studyFocusQuery.data}
            generateLoading={generateStudyFocusResult.loading}
            onGenerate={handleGenerateStudyFocus}
            onJump={jumpToLocator}
            onClose={() => setFocusPanelOpen(false)}
          />
        )}

        {/* The Quick Test session takeover (FR-14, T2): null while the reader
            owns the zone; on a seam dispatch or a ?quicktest=<sessionId> deep
            link it takes the material zone over at full height (AD-8 — the
            session id stays addressable). */}
        <QuickTestFlow material={material} planNodes={planQuery.data?.nodes ?? []} />
      </div>

      {immersive && (
        <button
          type="button"
          onClick={() => setImmersive(false)}
          aria-label={t("reader.immersiveOffAria")}
          className="fixed top-3 right-3 z-20 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--glass-5)] border border-border-soft shadow-raised text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function IconToggle({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] cursor-pointer"
    >
      {children}
    </button>
  );
}

/** Parsing state (UX spine): page-skeleton + progress copy, never a spinner-as-art. */
function ParsingSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="flex-1 overflow-y-auto bg-secondary/50">
      <div className="mx-auto w-full max-w-[980px] px-4 md:px-8 py-6 md:py-8 flex flex-col items-center gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="w-full max-w-[640px] aspect-[1/1.414] rounded-[4px] bg-card border border-border-soft" />
        ))}
        <p className="text-sm font-semibold">{t("reader.parsing")}</p>
        <p className="text-xs text-muted-foreground -mt-4">{t("reader.parsingHint")}</p>
      </div>
    </div>
  );
}

/** Failed state: honest bilingual reason + retry while the bytes exist (AD-7). */
function ParseFailedCard({
  materialId,
  reasonKey,
  hasBytes,
  onRetry,
  onReupload,
}: {
  materialId: string;
  reasonKey: string;
  hasBytes: boolean;
  onRetry(materialId: string): void;
  onReupload(): void;
}) {
  const { t } = useLanguage();
  return (
    <StateZone>
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <FileText className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("reader.parseFailedTitle")}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{t(reasonKey)}</p>
        {hasBytes ? (
          <button
            type="button"
            onClick={() => onRetry(materialId)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" /> {t("plans.parseRetry")}
          </button>
        ) : (
          <ReuploadAction onReupload={onReupload} hint />
        )}
      </div>
    </StateZone>
  );
}

/** Parsed-but-byteless (post-reload): the re-upload affordance (FR-29 relaxed). */
function ReuploadCard({ onReupload }: { onReupload(): void }) {
  const { t } = useLanguage();
  return (
    <StateZone>
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <Upload className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("reader.reuploadTitle")}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{t("reader.bytesGone")}</p>
        <ReuploadAction onReupload={onReupload} />
      </div>
    </StateZone>
  );
}

function ReuploadAction({ onReupload, hint }: { onReupload(): void; hint?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <button
        type="button"
        onClick={onReupload}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
      >
        <Upload className="w-3 h-3" aria-hidden="true" /> {t("plans.materialReuploadAction")}
      </button>
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{t("plans.materialsSessionNote")}</p>}
    </>
  );
}

function StateZone({ children }: { children: ReactNode }) {
  return (
    <div className={cn("flex-1 overflow-y-auto bg-secondary/50 flex items-center justify-center p-6")}>{children}</div>
  );
}
