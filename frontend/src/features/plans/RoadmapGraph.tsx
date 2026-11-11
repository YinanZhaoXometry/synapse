/**
 * The roadmap graph (FR-5; epic-28 T3 — the owner-settled roadmap.sh form
 * factor). The widget era is over: the graph renders INLINE IN THE PAGE FLOW
 * as one tall, narrow spine you browse by scrolling — no zoom, no pan, no
 * horizontal scroll anywhere (scale = container width / layout width, so the
 * full width always fits; narrow screens get proportionally smaller nodes,
 * the roadmap.sh posture). Epic-16's zoom/pan/pinch canvas and epic-20's
 * pinch batch retire with this rewrite (git history is the archive).
 *
 * Skin (epic-28, owner decision 2026-11-11): the roadmap.sh style parameters
 * COPIED VERBATIM (hub/leaf fills, black 2.7 borders, radius 5, the blue
 * edges at 3.5 with the dotted 0.8 8 fans, Balsamiq Sans 28px) — every value
 * lives in the --roadmap-* CSS variables (index.css) with identical values in
 * light and dark; only the canvas surface follows the theme. Zero raw colors
 * in this file (the guard test enforces it). No roadmap.sh content/assets are
 * copied (FR-43 wontfix stands).
 *
 * State vocabulary: node fills never encode mastery (NODE_STATE_FACE is
 * gone from the graph). Two independent corner badges — the Study Mark chip
 * top-right (blue 学习中 / green 已完成 / gray 已跳过; FR-47, orthogonal to
 * mastery) and the mastery glyph inline before the title (✦◐○, AD-9
 * not-color-only; server fields only, AD-14). Optional nodes keep the dashed
 * border + the 可选 marker.
 *
 * Keyboard (AD-9): leaves are focusable `g[role=button]` with roving
 * tabindex in reading order (stage by stage, left fan then right fan);
 * Up/Down walk that order, Left/Right jump to the same-row opposite-side
 * leaf; Enter/Space opens the detail sheet, Esc closes. Focus scrolls the
 * node into view (native scrollIntoView — there is no pan anymore). Hubs are
 * anchors, not tab stops. `?node=<id>` deep-links with the same mount-only
 * latch as epic-16 (consume once, ghost ids latched off, sheet opens as if
 * clicked).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MaterialNodeMappingView, MaterialView, PlanEdgeView, StudyMark } from "@/api/views";
import { cn } from "@/lib/utils";
import type { NodeRowView } from "./display-shaping";
import NodeActions from "./node-actions";
import { nodeLessonMaterial } from "./lesson-entry";
import { NodeStateBadge } from "./node-state-badge";
import StudyMarkToggleRow from "./study-mark-toggle";
import EvidenceMarks from "./evidence-marks";
import { NODE_STATE_DISPLAY, nodeJumpTargets } from "./node-state";
import {
  hubTitleLines,
  roadmapSpineLayout,
  SPINE_NODE_H,
  SPINE_NODE_W,
  type SpineBox,
} from "./roadmap-spine-layout";

/** The mark vocabulary's rendering: token color + i18n label key + glyph shape. */
const MARK_DISPLAY: Record<StudyMark, { colorVar: string; labelKey: string }> = {
  learning: { colorVar: "var(--roadmap-mark-learning)", labelKey: "plans.markLearning" },
  finished: { colorVar: "var(--roadmap-mark-finished)", labelKey: "plans.markFinished" },
  skipped: { colorVar: "var(--roadmap-mark-skipped)", labelKey: "plans.markSkipped" },
};

/**
 * Title truncation for the copied 30px face inside a 310px box: walk the
 * string, count CJK glyphs at full width and everything else at ~0.52em,
 * stop at the budget. Deterministic; the full title lives in the sheet
 * (and the hover overlay).
 */
function truncateForBox(title: string, maxPx: number): string {
  let used = 0;
  for (let i = 0; i < title.length; i += 1) {
    const code = title.codePointAt(i) ?? 0;
    const wide = code > 0x2e7f; // CJK ranges and above
    used += wide ? 30 : 15.5;
    if (used > maxPx) return `${title.slice(0, i)}…`;
  }
  return title;
}

/** The Study Mark chip (top-right corner, half outside the box like
 * roadmap.sh's badges): a white disc with the mark's shape in its color. */
function MarkChip({ box, mark }: { box: SpineBox; mark: StudyMark }) {
  const cx = box.x + SPINE_NODE_W - 14;
  const cy = box.y;
  const color = MARK_DISPLAY[mark].colorVar;
  return (
    <g data-testid="roadmap-node-mark" data-mark={mark} aria-hidden="true">
      <circle cx={cx} cy={cy} r={8.5} fill="hsl(var(--card))" stroke={color} strokeWidth={2} />
      {mark === "finished" && (
        <path
          d={`M ${cx - 3.6} ${cy + 0.4} L ${cx - 0.8} ${cy + 3.2} L ${cx + 3.8} ${cy - 3}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {mark === "learning" && <path d={`M ${cx - 2.4} ${cy - 3.6} L ${cx + 4} ${cy} L ${cx - 2.4} ${cy + 3.6} Z`} fill={color} />}
      {mark === "skipped" && (
        <path d={`M ${cx - 3.6} ${cy} L ${cx + 3.6} ${cy}`} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </g>
  );
}

export default function RoadmapGraph({
  planId,
  views,
  materials,
  edges,
  mappings,
  mappingsFailed = false,
  onTeachNode,
  onLessonNode,
  lessonHint = null,
}: {
  planId: string;
  /** The plan's node rows, already shaped by nodeRowViews (score/state server fields, AD-14). */
  views: NodeRowView[];
  materials: MaterialView[];
  /** The plan's persisted prerequisite edges (epic-16 rows) — the spine
   * layout's prereq input; a zero-edge plan renders the pure spine. */
  edges?: PlanEdgeView[];
  /** The plan-scope batch mapping rows; undefined while the read is in flight. */
  mappings?: MaterialNodeMappingView[];
  mappingsFailed?: boolean;
  /** The AI 讲解 entry (epic-34 T2): the plan page shell opens its Companion
   * drawer pre-filled for that node. */
  onTeachNode: (nodeId: string, nodeTitle: string) => void;
  /** epic-36 T2 (生成讲义): the shell creates/opens the node's lesson. */
  onLessonNode?: (nodeId: string, nodeTitle: string) => void;
  /** The composed entry hint (estimate × remaining); null while either read is in flight. */
  lessonHint?: string | null;
}) {
  const { t } = useLanguage();
  const { reduceMotion } = useTheme();
  const [searchParams] = useSearchParams();

  // The ONE layout (epic-28): the deterministic spine — hubs per stage,
  // balanced fans, structural spine/fan edges + the sanitized prereq data.
  const layout = useMemo(
    () =>
      roadmapSpineLayout(
        views.map((view) => ({ id: view.node.id, order: view.node.order, stage: view.node.stage })),
        (edges ?? []).map((edge) => ({ from: edge.fromNodeId, to: edge.toNodeId })),
      ),
    [views, edges],
  );
  const byId = useMemo(() => new Map(views.map((view) => [view.node.id, view])), [views]);

  // Scale = container width / layout width (the full width always fits —
  // no horizontal scroll by construction). Unmeasured containers (first
  // paint, jsdom) render at scale 1 and rescale on the first observation.
  const containerRef = useRef<HTMLDivElement>(null);
  const observedWidthRef = useRef(0);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      observedWidthRef.current = width;
      if (width > 0) setScale(width / layout.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.width]);
  useEffect(() => {
    // A new layout width (plan switch / data refresh) rescales against the
    // last measured width without waiting for the next resize event.
    if (observedWidthRef.current > 0) setScale(observedWidthRef.current / layout.width);
  }, [layout.width]);

  // Plan progress off the SERVER states (AD-14): the bar counts mastered
  // nodes; the client renders the share, never recomputes a score. The mark
  // line counts the self-declared marks (FR-47) — displayed, never merged
  // into the mastery bar (the orthogonality contract, ADR-0002).
  const total = views.length;
  const masteredCount = views.filter((view) => view.state === "mastered").length;
  const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
  const markCount = (mark: StudyMark) => views.filter((view) => view.node.studyMark === mark).length;

  // The roving tabindex rides the layout's reading order (stage by stage,
  // left fan then right fan). Hubs are not tab stops.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(() => layout.readingOrder[0] ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [chipsVisible, setChipsVisible] = useState(false);
  const hoverIntentRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const nodeRefs = useRef(new Map<string, SVGElement>());

  // The hover chip strip (epic-28 T4, hide contract reworked in T04): ~150ms
  // hover-intent so brushing the canvas never flickers chips; leaving a NODE
  // now schedules the ~120ms GRACE hide directly — the epic-28 posture
  // (container-only hiding, because a strip flush on the node sat under a
  // stationary pointer) died with T03's gap: the strip floats above the
  // node's top edge, so the pointer always rests ON the node and a per-node
  // leave is honest. Entering the strip or another node cancels the grace;
  // the strip's own leave re-schedules; the CONTAINER's leave stays as the
  // final fallback. TOUCH never opens the strip (tap = the sheet, unchanged)
  // — a touch pointerleave scheduling a hide of nothing is a no-op.
  // Keyboard never opens it either — Enter opens the sheet, which carries
  // the same actions.
  const clearHoverIntent = () => {
    if (hoverIntentRef.current !== null) {
      window.clearTimeout(hoverIntentRef.current);
      hoverIntentRef.current = null;
    }
  };
  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setChipsVisible(false);
      setHoveredId(null);
    }, 120);
  };
  const onNodePointerEnter = (id: string, event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    cancelHide();
    setHoveredId(id);
    clearHoverIntent();
    hoverIntentRef.current = window.setTimeout(() => setChipsVisible(true), 150);
  };
  useEffect(
    () => () => {
      clearHoverIntent();
      cancelHide();
    },
    [],
  );

  useEffect(() => {
    // Focused-id reconciliation (review finding 4 posture): when the focused
    // id leaves the layout (rows changed underneath), reseed to the first
    // leaf so the graph never loses Tab reachability.
    setFocusedId((current) =>
      current !== null && layout.boxes[current] && layout.boxes[current].kind === "leaf"
        ? current
        : (layout.readingOrder[0] ?? null),
    );
  }, [layout]);

  // Focus scrolls the node into view — native, because there is no pan
  // anymore. jsdom (no scrollIntoView) and hidden containers skip silently.
  const focusNode = (id: string) => {
    setFocusedId(id);
    const el = nodeRefs.current.get(id);
    if (el && typeof el.focus === "function") el.focus();
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  };

  const moveFocus = (id: string) => {
    if (layout.boxes[id]) focusNode(id);
  };

  const nextBox = (box: SpineBox, key: string): SpineBox | undefined => {
    const at = (id: string) => layout.boxes[id];
    if (key === "ArrowUp" || key === "ArrowDown") {
      const index = layout.readingOrder.indexOf(box.id);
      if (index < 0) return undefined;
      const next = key === "ArrowUp" ? index - 1 : index + 1;
      if (next < 0 || next >= layout.readingOrder.length) return undefined;
      return at(layout.readingOrder[next]);
    }
    // Left/Right: the nearest-row leaf in the PREVIOUS/NEXT stage (one fan
    // per stage now — sections are discrete, so horizontal = across the
    // spine; the closest row keeps the pointer honest). Deterministic:
    // reading order breaks y ties.
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const stageIndex = layout.hubs.findIndex((hub) => hub.stage === box.stage);
      const neighbor = layout.hubs[key === "ArrowLeft" ? stageIndex - 1 : stageIndex + 1];
      if (!neighbor || neighbor.leafIds.length === 0) return undefined;
      let best: SpineBox | undefined;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const id of neighbor.leafIds) {
        const candidate = at(id);
        const delta = Math.abs(candidate.y - box.y);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = candidate;
        }
      }
      return best;
    }
    return undefined;
  };

  // Deep-link (`?node=<id>`): MOUNT-ONLY semantics, unchanged from epic-16 —
  // consumed once on the first layout that can resolve it, ghost ids latched
  // off, the param stays in the URL.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    const id = searchParams.get("node");
    if (!id) return;
    if (layout.readingOrder.length === 0) return;
    deepLinkDoneRef.current = true;
    if (!layout.boxes[id] || layout.boxes[id].kind !== "leaf") return;
    setSelectedId(id);
    focusNode(id);
  }, [searchParams, layout]);

  const onNodeKeyDown = (event: React.KeyboardEvent, box: SpineBox) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(box.id);
      return;
    }
    if (event.key === "Escape") {
      setSelectedId(null);
      return;
    }
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const target = nextBox(box, event.key);
      if (target) moveFocus(target.id);
    }
  };

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedTargets =
    mappings && selectedId
      ? nodeJumpTargets(
          mappings.filter((row) => row.nodeId === selectedId),
          materials,
        )
      : null;
  const hoveredTargets =
    mappings && hoveredId
      ? nodeJumpTargets(
          mappings.filter((row) => row.nodeId === hoveredId),
          materials,
        )
      : null;
  // epic-36 T2: the per-node existing lesson id (「打开讲义」 deformation) —
  // the same materials read the jump targets resolve against.
  const lessonMaterialFor = (nodeId: string | null | undefined): string | null =>
    onLessonNode && nodeId ? (nodeLessonMaterial(materials, nodeId)?.id ?? null) : null;

  if (views.length === 0) {
    return <p className="text-xs text-muted-foreground px-1">{t("plans.graphEmpty")}</p>;
  }

  const hovered = hoveredId ? byId.get(hoveredId) : undefined;
  const hoveredBox = hoveredId ? layout.boxes[hoveredId] : undefined;

  return (
    <div>
      {/* The plan progress bar (mastered x of y — SERVER states, AD-14) + the
          mark-count line (FR-47 — displayed, never merged into the bar) + the
          badge-style legend. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div
              role="progressbar"
              aria-label={t("plans.graphProgressAria")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              data-testid="roadmap-progress"
              className="h-[7px] w-[180px] flex-none overflow-hidden rounded-full bg-[hsl(var(--border-soft))]"
            >
              <div
                className={cn("h-full rounded-full bg-accent", !reduceMotion && "transition-[width] duration-500 ease-out")}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              <b className="font-semibold text-foreground">{masteredCount}</b>/{total} {t("plans.graphProgressUnit")} ·{" "}
              {percent}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums" data-testid="roadmap-marks-line">
            {t("plans.graphMarksLine", {
              finished: markCount("finished"),
              learning: markCount("learning"),
              skipped: markCount("skipped"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="roadmap-legend">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: "var(--roadmap-mark-learning)" }} aria-hidden="true" />
            {t("plans.markLearning")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: "var(--roadmap-mark-finished)" }} aria-hidden="true" />
            {t("plans.markFinished")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-full" style={{ background: "var(--roadmap-mark-skipped)" }} aria-hidden="true" />
            {t("plans.markSkipped")}
          </span>
          <span aria-hidden="true" className="text-border">|</span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block font-semibold" style={{ color: "var(--roadmap-node-ink)" }}>✦</i>
            {t("plans.stateMastered")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block font-semibold" style={{ color: "var(--roadmap-node-ink)" }}>◐</i>
            {t("plans.statePartial")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block font-semibold" style={{ color: "var(--roadmap-node-ink)" }}>○</i>
            {t("plans.stateUncovered")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-[3px] border border-dashed border-muted-foreground" aria-hidden="true" />
            {t("plans.nodeOptional")}
          </span>
        </div>
      </div>

      {/* The full-page spine: inline in the page flow, width-fitted by the
          viewBox, height follows the layout — the page's own scrollbar is the
          only navigation. The canvas testid survives (the graph surface's
          stable handle, same contract as the widget era). */}
      <div
        ref={containerRef}
        data-testid="roadmap-canvas"
        data-motion={reduceMotion ? "off" : "on"}
        onPointerLeave={() => scheduleHide()}
        className="relative w-full"
      >
        <svg
          role="group"
          aria-label={t("plans.graphAria")}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          style={{ height: "auto", display: "block" }}
          className="roadmap-font select-none"
          data-testid="roadmap-svg"
        >
          {/* Structural edges first (behind nodes): the SOLID spine between
              hubs, the DOTTED fans, the dotted prereq brackets/dips — the
              copied `0.8 8` dots need round caps. No arrowheads anywhere
              (direction is the top-down geometry). */}
          {layout.edges.map((edge) => (
            <path
              key={`${edge.kind}-${edge.from}-${edge.to}`}
              data-testid="roadmap-edge"
              data-edge-kind={edge.kind}
              data-edge-from={edge.from}
              data-edge-to={edge.to}
              d={edge.d}
              fill="none"
              stroke="var(--roadmap-edge)"
              strokeWidth={3.5}
              strokeLinecap={edge.kind === "spine" ? "butt" : "round"}
              strokeDasharray={edge.kind === "spine" ? undefined : "0.8 8"}
            />
          ))}

          {/* The stage hub cards: the copied main-node skin — interactive
              NOTHING (anchors, not knowledge nodes). Title centered at the
              copied 28px; the per-stage mastered/total right-inset. */}
          {layout.hubs.map((hub) => {
            const box = layout.boxes[hub.id];
            const stageMastered = hub.leafIds.filter((id) => byId.get(id)?.state === "mastered").length;
            // The hub title wraps to at most two width-measured lines (the
            // owner's overflow report); the box grew with it in the layout.
            const lines = hub.stage === null ? hubTitleLines(t("plans.stageUngrouped")) : hub.lines;
            const lineBaseline = (index: number) =>
              box.y + box.h / 2 + 11 + (index - (lines.length - 1) / 2) * 32;
            return (
              <g key={hub.id} data-testid="roadmap-stage-group" data-stage={hub.stage}>
                <rect
                  x={box.x}
                  y={box.y}
                  width={SPINE_NODE_W}
                  height={box.h}
                  rx={10}
                  style={{ fill: "var(--roadmap-hub-face)", stroke: "var(--roadmap-node-border)" }}
                  strokeWidth={2.7}
                />
                {lines.map((line, index) => (
                  <text
                    key={index}
                    data-testid="roadmap-stage-label"
                    x={box.x + SPINE_NODE_W / 2}
                    y={lineBaseline(index)}
                    fontSize={30}
                    textAnchor="middle"
                    style={{ fill: "var(--roadmap-node-ink)" }}
                  >
                    {line}
                  </text>
                ))}
                <text
                  data-testid="roadmap-stage-progress"
                  x={box.x + SPINE_NODE_W - 14}
                  y={box.y + 18}
                  fontSize={14}
                  textAnchor="end"
                  fillOpacity={0.62}
                  style={{ fill: "var(--roadmap-node-ink)" }}
                >
                  {stageMastered}/{hub.leafIds.length}
                </text>
              </g>
            );
          })}

          {/* The knowledge nodes (leaves): the copied secondary-node skin +
              the dual corner vocabulary (mark chip top-right, mastery glyph
              inline-left). */}
          {layout.readingOrder.map((id) => {
            const box = layout.boxes[id];
            const view = byId.get(id);
            if (!view) return null;
            const display = NODE_STATE_DISPLAY[view.state];
            const focused = focusedId === id;
            const mark = view.node.studyMark;
            const markDisplay = mark ? MARK_DISPLAY[mark] : null;
            const title = truncateForBox(view.node.title, SPINE_NODE_W - 66);
            const markSuffix = markDisplay ? t("plans.markAriaSuffix", { mark: t(markDisplay.labelKey) }) : "";
            const ariaLabel =
              (view.node.optional
                ? t("plans.graphNodeAriaOptional", { node: view.node.title, state: t(display.labelKey) })
                : t("plans.graphNodeAria", { node: view.node.title, state: t(display.labelKey) })) + markSuffix;
            return (
              <g
                key={id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(id, el);
                }}
                data-testid="roadmap-node"
                data-node-id={id}
                data-focused={focused ? "true" : "false"}
                role="button"
                tabIndex={focused ? 0 : -1}
                aria-label={ariaLabel}
                onPointerEnter={(event) => onNodePointerEnter(id, event)}
                onPointerLeave={scheduleHide}
                onClick={() => {
                  setSelectedId(id);
                  setFocusedId(id);
                  clearHoverIntent();
                  cancelHide();
                  setHoveredId(null);
                  setChipsVisible(false);
                }}
                onFocus={() => setFocusedId(id)}
                onKeyDown={(event) => onNodeKeyDown(event, box)}
                className="cursor-pointer"
              >
                <rect
                  x={box.x}
                  y={box.y}
                  width={SPINE_NODE_W}
                  height={SPINE_NODE_H}
                  rx={10}
                  style={{
                    fill: "var(--roadmap-leaf-face)",
                    stroke: focused ? "hsl(var(--ring))" : "var(--roadmap-node-border)",
                  }}
                  strokeWidth={focused ? 3.4 : 2.7}
                  strokeDasharray={view.node.optional ? "6 4" : undefined}
                />
                {focused && (
                  <rect
                    data-testid="roadmap-node-ring"
                    x={box.x - 4}
                    y={box.y - 4}
                    width={SPINE_NODE_W + 8}
                    height={SPINE_NODE_H + 8}
                    rx={13}
                    fill="none"
                    stroke="hsl(var(--ring))"
                    strokeWidth={2.5}
                  />
                )}
                {/* The mastery glyph, inline before the title (AD-9
                    not-color-only; the server state rendered, AD-14). */}
                <text
                  data-testid="roadmap-node-glyph"
                  x={box.x + 20}
                  y={box.y + SPINE_NODE_H / 2 + 11}
                  fontSize={24}
                  aria-hidden="true"
                  style={{ fill: "var(--roadmap-node-ink)" }}
                >
                  {display.glyph}
                </text>
                <text
                  x={box.x + 56}
                  y={box.y + SPINE_NODE_H / 2 + 11}
                  fontSize={30}
                  style={{ fill: "var(--roadmap-node-ink)" }}
                >
                  {title}
                </text>
                {/* The optional marker (AD-9): dashed chip + word, top-right
                    inside (the mark chip rides the corner outside). */}
                {view.node.optional && (
                  <g data-testid="roadmap-node-optional">
                    <rect
                      x={box.x + SPINE_NODE_W - 66}
                      y={box.y + 9}
                      width={8}
                      height={8}
                      rx={2}
                      fill="none"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.2}
                      strokeDasharray="3 2"
                    />
                    <text
                      x={box.x + SPINE_NODE_W - 53}
                      y={box.y + 17}
                      fontSize={12}
                      fill="hsl(var(--muted-foreground))"
                    >
                      {t("plans.nodeOptional")}
                    </text>
                  </g>
                )}
                {mark && <MarkChip box={box} mark={mark} />}
              </g>
            );
          })}
        </svg>

        {/* The hover chip strip (epic-28 T4, reworked T03/T04): row 1 = the
            Study Mark toggles, row 2 = the node's actions (NodeActions
            verbatim). The zero-width ANCHOR sits at the node's top-edge
            CENTER (top = nodeTop·scale, left = centerX — exact, NO clamp:
            the lg+ layout's rail leaves 300px+ of page to the right of the
            canvas, so a centered strip on a right-column leaf paints over
            the rail and never past the viewport; touch never opens it) and
            the strip hangs off it with bottom-1 + -translate-x-1/2:
            structurally ALWAYS above the node, centers on the node's
            vertical axis. Glass face = the --popover-glass token (skin
            guard: no raw rgba/hex here). Pointer events ON the strip (the
            chips are clickable; entering it cancels the grace hide, leaving
            it re-schedules), OFF the anchor; hidden while unhovered, during
            the intent delay, and for touch (tap = the sheet). */}
        {hovered && hoveredBox && chipsVisible && (
          <div
            data-testid="roadmap-chips-anchor"
            className="pointer-events-none absolute z-10 w-0"
            style={{
              left: hoveredBox.x * scale + (SPINE_NODE_W * scale) / 2,
              top: hoveredBox.y * scale,
            }}
          >
            <div
              data-testid="roadmap-chips"
              onPointerEnter={cancelHide}
              onPointerLeave={scheduleHide}
              className="pointer-events-auto absolute bottom-1 left-0 flex w-max -translate-x-1/2 flex-col items-start gap-1 rounded-xl border border-border-soft bg-[var(--popover-glass)] px-2 py-1.5 shadow-raised backdrop-blur-[6px]"
            >
              <div className="flex items-center gap-2">
                <span className="max-w-[260px] truncate text-xs font-semibold text-foreground">{hovered.node.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t(NODE_STATE_DISPLAY[hovered.state].labelKey)}
                  {hovered.node.optional ? ` · ${t("plans.nodeOptional")}` : ""}
                </span>
              </div>
              <StudyMarkToggleRow nodeId={hovered.node.id} mark={hovered.node.studyMark} compact />
              <NodeActions
                targets={hoveredTargets}
                failed={mappingsFailed}
                planId={planId}
                nodeId={hovered.node.id}
                nodeTitle={hovered.node.title}
                onTeach={onTeachNode}
                lessonMaterialId={lessonMaterialFor(hovered.node.id)}
                lessonHint={lessonHint}
                onLesson={onLessonNode}
              />
            </div>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground px-1">{t("plans.graphHint")}</p>

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent data-testid="roadmap-detail" className="w-[320px] sm:w-[360px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-lg">{selected.node.title}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("plans.graphNodeAria", { node: selected.node.title, state: t(NODE_STATE_DISPLAY[selected.state].labelKey) })}
                </SheetDescription>
              </SheetHeader>
              {/* The Study Mark row (FR-47): self-declared status, revocable —
                  orthogonal to the mastery badge beside it (ADR-0002). */}
              <div className="mt-3">
                <StudyMarkToggleRow nodeId={selected.node.id} mark={selected.node.studyMark} />
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <NodeStateBadge state={selected.state} />
                {selected.node.optional && (
                  <span
                    data-testid="roadmap-node-optional-badge"
                    className="pill pill-muted border-dashed flex-none"
                  >
                    {t("plans.nodeOptional")}
                  </span>
                )}
                {selected.node.studyMark && (
                  <span
                    data-testid="roadmap-node-mark-badge"
                    className="pill flex-none border"
                    style={{ borderColor: MARK_DISPLAY[selected.node.studyMark].colorVar, color: MARK_DISPLAY[selected.node.studyMark].colorVar }}
                  >
                    {t(MARK_DISPLAY[selected.node.studyMark].labelKey)}
                  </span>
                )}
                <span className="font-display font-bold tabular-nums text-sm text-muted-foreground">
                  {selected.hasEvidence ? `${selected.score}%` : "—"}
                </span>
              </div>
              {/* The node's one-line description (epic-16): server truth when
                  present; legacy nodes carry the honest fallback line. */}
              <p
                data-testid="roadmap-node-desc"
                className={cn(
                  "mt-3 text-xs leading-[1.6]",
                  selected.node.description ? "text-foreground opacity-85" : "text-muted-foreground",
                )}
              >
                {selected.node.description ?? t("plans.graphNodeDescFallback")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* The 讲解 click closes the sheet — the Companion drawer it
                    opens lives on the plan page shell underneath. */}
                <NodeActions
                  targets={selectedTargets}
                  failed={mappingsFailed}
                  planId={planId}
                  nodeId={selected.node.id}
                  nodeTitle={selected.node.title}
                  onTeach={(nodeId, nodeTitle) => {
                    setSelectedId(null);
                    onTeachNode(nodeId, nodeTitle);
                  }}
                  lessonMaterialId={lessonMaterialFor(selected.node.id)}
                  lessonHint={lessonHint}
                  onLesson={(nodeId, nodeTitle) => {
                    setSelectedId(null);
                    onLessonNode?.(nodeId, nodeTitle);
                  }}
                />
              </div>
              {mappings === undefined && !mappingsFailed && (
                <p className="mt-3 text-xs text-muted-foreground">{t("plans.graphActionsPending")}</p>
              )}
              {/* The evidence bar (epic-28 T4): the same ●◐✕ window the list
                  view's popover shows — the sheet explains the score instead
                  of just displaying it. */}
              <div className="mt-4 rounded-xl border border-border-soft bg-[var(--glass-1)] p-3">
                <EvidenceMarks outcomes={selected.lastOutcomes} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
