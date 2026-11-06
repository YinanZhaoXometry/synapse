/**
 * The roadmap graph (epic P2-10 T4, FR-5; delta decision 1 — custom SVG, ZERO
 * new dependencies, NFR-6; epic-16 upgrades the structure: persisted
 * prerequisite edges render through the pure DAG layout — swimlane stage
 * columns, barycenter ordering, orthogonal elbows with arrowheads — while
 * zero-edge plans keep the epic-10 derived-sequence layout, selected per-plan
 * by edge presence). The UX spine names the graph "a view tab
 * inside Plan Home" (EXPERIENCE.md Phase-2 positions); the node detail is a
 * SIDE SHEET (the spine is silent on panel-vs-sheet — recorded in the ticket:
 * a sheet keeps the pannable canvas context visible, matching the scaffold's
 * floating-layer posture, DESIGN.md).
 *
 * Nodes render the T3 state vocabulary on the face (glyph + tint, AD-9
 * never-color-only — server fields only, AD-14). Epic-16 T3 adds the roadmap
 * reading vocabulary (the style-reference mock's structure, colors mapped to
 * the app's semantic tokens only): OPTIONAL nodes render a dashed border plus
 * a visible 「可选」 marker line and the optional aria-label; tinted
 * stage-group containers carry the stage title and its mastered/total;
 * the plan progress bar above the canvas counts mastered nodes off the
 * SERVER states (never recomputed — ADR-0001, AD-14); hovering a node shows
 * a tooltip (title + state + optional marker); the side sheet gains the
 * node's description line + optional badge; a fit-view button rescales and
 * recenters the whole roadmap. `?node=<id>` deep-links: on mount the node
 * selects, pans into view (the SAME ensureBoxVisible path the keyboard uses)
 * and the sheet opens as if clicked.
 *
 * Keyboard (AD-9): every node is a focusable `g[role=button]` with an
 * aria-label, roving tabindex (up/down within a column, left/right across
 * columns, clamped), Enter/Space opens the detail, Esc closes; the focused
 * node carries the semantic-token focus ring. Pan = pointer drag on the
 * canvas; zoom = buttons + WHEEL INSIDE THE CANVAS (epic-16 posture: plain
 * wheel zooms, ctrl/cmd+wheel kept as an alias — native non-passive listener,
 * the clamp/step unchanged from epic-10). The app's motion setting
 * (ThemeContext, like every surface) and prefers-reduced-motion disable the
 * smooth transform transitions.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import { cn } from "@/lib/utils";
import type { NodeRowView } from "./display-shaping";
import NodeActions from "./node-actions";
import { NodeStateBadge } from "./node-state-badge";
import { NODE_STATE_DISPLAY, NODE_STATE_FACE, nodeJumpTargets } from "./node-state";
import {
  planGraphEdgePath,
  planGraphLayout,
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  ROADMAP_PADDING,
  ROADMAP_HEADER_H,
  ROADMAP_ROW_GAP,
  type RoadmapBox,
  type RoadmapColumn,
} from "./roadmap-dag-layout";
import type { PlanEdgeView } from "@/api/views";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
/** Breathing room kept around a focused node when panning it into view (px). */
const FOCUS_PAN_MARGIN = 16;
/** Breathing room the fit-view keeps at the viewport edges (px). */
const FIT_MARGIN = 24;
/**
 * Fit-view's zoom cap — a small roadmap must not blow up to fill a large
 * viewport (the style-reference mock's 1.15 posture; the epic-10 min/max
 * clamp below still applies).
 */
const FIT_ZOOM_CAP = 1.15;

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

/** The stage-group container band around one column (tinted group background). */
function stageGroupRect(column: RoadmapColumn) {
  const rows = Math.max(1, column.nodeIds.length);
  const top = ROADMAP_PADDING - 12;
  const bottom = ROADMAP_PADDING + ROADMAP_HEADER_H + (rows - 1) * (ROADMAP_NODE_H + ROADMAP_ROW_GAP) + ROADMAP_NODE_H + 14;
  return { x: column.x - 14, y: top, width: ROADMAP_NODE_W + 28, height: bottom - top };
}

export default function RoadmapGraph({
  planId,
  views,
  materials,
  edges,
  mappings,
  mappingsFailed = false,
}: {
  planId: string;
  /** The plan's node rows, already shaped by nodeRowViews (score/state server fields, AD-14). */
  views: NodeRowView[];
  materials: MaterialView[];
  /** The plan's persisted prerequisite edges (epic-16, server rows) — the
   * DAG layout's input; a zero-edge plan falls back to the epic-10
   * derived-sequence layout (per-plan selection by edge presence). */
  edges?: PlanEdgeView[];
  /** The plan-scope batch mapping rows; undefined while the read is in flight. */
  mappings?: MaterialNodeMappingView[];
  mappingsFailed?: boolean;
}) {
  const { t } = useLanguage();
  const { reduceMotion } = useTheme();
  const [searchParams] = useSearchParams();
  // The per-plan layout selection (epic-16): persisted edges → the swimlane
  // DAG with barycenter ordering; zero edges → the legacy derived sequence.
  const graph = useMemo(
    () =>
      planGraphLayout(
        views.map((view) => ({ id: view.node.id, order: view.node.order, stage: view.node.stage })),
        (edges ?? []).map((edge) => ({ from: edge.fromNodeId, to: edge.toNodeId })),
      ),
    [views, edges],
  );
  const layout = graph.layout;
  const byId = useMemo(() => new Map(views.map((view) => [view.node.id, view])), [views]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(() => layout.columns[0]?.nodeIds[0] ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, SVGElement>());

  // Plan progress off the SERVER states (AD-14): the bar counts mastered
  // nodes; the client renders the share, never recomputes a score.
  const total = views.length;
  const masteredCount = views.filter((view) => view.state === "mastered").length;
  const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

  // WHEEL INSIDE THE CANVAS zooms (epic-16 posture: plain wheel zooms — the
  // canvas is a bounded surface, so page-scroll hijack is not a concern —
  // and ctrl/cmd+wheel stays an alias). Rides a NATIVE non-passive listener
  // — React's root wheel listener is passive and preventDefault (blocking
  // the browser's page zoom / scroll) would be swallowed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // The roving tabindex is seeded once at mount — if the focused node ever
  // leaves `views` while mounted (plan rows change underneath the graph), no
  // <g> would carry tabIndex=0 and the graph would be Tab-unreachable.
  // Reconcile: whenever the focused id is no longer in the layout, reseed it
  // to the first node (review finding 4).
  useEffect(() => {
    setFocusedId((current) =>
      current !== null && layout.boxes[current]
        ? current
        : (layout.columns[0]?.nodeIds[0] ?? null),
    );
  }, [layout]);

  // The column/row grid for arrow traversal: (column, row) → box.
  const grid = useMemo(() => {
    const map = new Map<string, RoadmapBox>();
    for (const box of Object.values(layout.boxes)) map.set(`${box.column}:${box.row}`, box);
    return map;
  }, [layout]);

  const nextBox = (box: RoadmapBox, key: string): RoadmapBox | undefined => {
    const sizes = layout.columns.map((column) => column.nodeIds.length);
    const at = (column: number, row: number) => grid.get(`${column}:${row}`);
    switch (key) {
      case "ArrowUp":
        return at(box.column, Math.max(0, box.row - 1));
      case "ArrowDown":
        return at(box.column, Math.min(sizes[box.column] - 1, box.row + 1));
      case "ArrowLeft":
        return box.column > 0 ? at(box.column - 1, Math.min(box.row, sizes[box.column - 1] - 1)) : undefined;
      case "ArrowRight":
        return box.column < layout.columns.length - 1
          ? at(box.column + 1, Math.min(box.row, sizes[box.column + 1] - 1))
          : undefined;
      default:
        return undefined;
    }
  };

  // Keyboard focus must never land on a clipped, invisible node: the canvas
  // is `overflow-hidden`, so arrowing past the visible rows would park focus
  // where nothing paints. Pan just enough to bring the focused box fully
  // into the measured viewport (transform space: screen = pan + layout·zoom,
  // transformOrigin 0 0). The smooth transition is the CSS class already
  // gated on data-motion, so reduced-motion pans instantly (review finding 2).
  const ensureBoxVisible = (box: RoadmapBox) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (viewW <= 0 || viewH <= 0) return; // unmeasured (hidden canvas / jsdom) — nothing to compute against
    const left = pan.x + box.x * zoom;
    const top = pan.y + box.y * zoom;
    const right = left + ROADMAP_NODE_W * zoom;
    const bottom = top + ROADMAP_NODE_H * zoom;
    const dx = left < FOCUS_PAN_MARGIN
      ? FOCUS_PAN_MARGIN - left
      : right > viewW - FOCUS_PAN_MARGIN
        ? viewW - FOCUS_PAN_MARGIN - right
        : 0;
    const dy = top < FOCUS_PAN_MARGIN
      ? FOCUS_PAN_MARGIN - top
      : bottom > viewH - FOCUS_PAN_MARGIN
        ? viewH - FOCUS_PAN_MARGIN - bottom
        : 0;
    if (dx !== 0 || dy !== 0) setPan({ x: pan.x + dx, y: pan.y + dy });
  };

  const focusNode = (box: RoadmapBox) => {
    setFocusedId(box.id);
    const el = nodeRefs.current.get(box.id);
    if (el && typeof el.focus === "function") el.focus();
    ensureBoxVisible(box);
  };

  // Deep-link (`?node=<id>`, spec): on mount — and whenever the param or the
  // layout changes — select the node, pan it into view (the SAME path the
  // keyboard uses) and open the sheet as if clicked. An id that is not one of
  // the plan's nodes is ignored. The param stays in the URL (bookmarkable).
  useEffect(() => {
    const id = searchParams.get("node");
    if (!id) return;
    const box = layout.boxes[id];
    if (!box) return;
    setSelectedId(id);
    focusNode(box);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, layout]);

  const onNodeKeyDown = (event: React.KeyboardEvent, box: RoadmapBox) => {
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
      if (target) focusNode(target);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({ x: drag.originX + (event.clientX - drag.x), y: drag.originY + (event.clientY - drag.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Fit-view: rescale + recenter so the WHOLE roadmap is visible (a small
  // roadmap caps at FIT_ZOOM_CAP; the epic-10 clamp still bounds the result).
  const fitView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (viewW <= 0 || viewH <= 0) {
      // unmeasured (hidden canvas / jsdom) — fall back to the identity view.
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const k = clampZoom(Math.min((viewW - FIT_MARGIN) / layout.width, (viewH - FIT_MARGIN) / layout.height, FIT_ZOOM_CAP));
    setZoom(k);
    setPan({ x: (viewW - layout.width * k) / 2, y: (viewH - layout.height * k) / 2 });
  };

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedTargets =
    mappings && selectedId
      ? nodeJumpTargets(
          mappings.filter((row) => row.nodeId === selectedId),
          materials,
        )
      : null;

  if (views.length === 0) {
    return <p className="text-xs text-muted-foreground px-1">{t("plans.graphEmpty")}</p>;
  }

  const hovered = hoveredId ? byId.get(hoveredId) : undefined;
  const hoveredBox = hoveredId ? layout.boxes[hoveredId] : undefined;

  return (
    <div>
      {/* The plan progress bar + the state legend (epic-16 T3): mastered
          x of y + percent off the SERVER states, above the canvas. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="roadmap-legend">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-[3px] bg-mastered" aria-hidden="true" />
            {t("plans.stateMastered")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-[3px] bg-partial" aria-hidden="true" />
            {t("plans.statePartial")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-[3px] border border-muted-foreground bg-card" aria-hidden="true" />
            {t("plans.stateUncovered")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 flex-none rounded-[3px] border border-dashed border-muted-foreground" aria-hidden="true" />
            {t("plans.nodeOptional")}
          </span>
        </div>
      </div>

      <div
        ref={canvasRef}
        data-testid="roadmap-canvas"
        data-motion={reduceMotion ? "off" : "on"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[440px] overflow-hidden rounded-2xl border border-border-soft bg-card shadow-raised cursor-grab active:cursor-grabbing select-none"
      >
        <div
          data-testid="roadmap-viewport"
          className={cn("absolute inset-0 will-change-transform", !reduceMotion && "roadmap-viewport-motion")}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
        >
          <svg
            role="group"
            aria-label={t("plans.graphAria")}
            width={layout.width}
            height={layout.height}
            data-testid="roadmap-svg"
          >
            {/* The dependency arrowhead — one shared marker, token-colored. */}
            <defs>
              <marker
                id="roadmap-arrow"
                viewBox="0 0 10 10"
                refX={9}
                refY={5}
                markerWidth={7}
                markerHeight={7}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" fillOpacity={0.55} />
              </marker>
            </defs>
            {/* Tinted stage-group containers (behind edges + nodes) with the
                stage title and its mastered/total — both layout paths expose
                columns, so the vocabulary renders for DAG and legacy alike. */}
            {layout.columns.map((column) => {
              const rect = stageGroupRect(column);
              const stageMastered = column.nodeIds.filter((id) => byId.get(id)?.state === "mastered").length;
              return (
                <g key={`group-${column.nodeIds[0] ?? column.x}`}>
                  <rect
                    data-testid="roadmap-stage-group"
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx={14}
                    style={{ fill: "var(--accent-tint)" }}
                    fillOpacity={0.5}
                    stroke="hsl(var(--border-soft))"
                  />
                  <text
                    data-testid="roadmap-stage-label"
                    x={column.x + 2}
                    y={12 + 14}
                    fontSize={11}
                    fontWeight={600}
                    fill="hsl(var(--muted-foreground))"
                  >
                    {column.stage ?? t("plans.stageUngrouped")}
                  </text>
                  <text
                    data-testid="roadmap-stage-progress"
                    x={column.x + ROADMAP_NODE_W}
                    y={12 + 14}
                    fontSize={11}
                    textAnchor="end"
                    fill="hsl(var(--muted-foreground))"
                  >
                    {stageMastered}/{column.nodeIds.length}
                  </text>
                </g>
              );
            })}
            {layout.edges.map((edge) => {
              const from = layout.boxes[edge.from];
              const to = layout.boxes[edge.to];
              if (!from || !to) return null;
              // On the DAG, persisted prerequisites render as token-colored
              // orthogonal arrows; an edge touching an optional node renders
              // dashed (the optional path). The legacy fallback keeps the
              // epic-10 pseudo-edge look untouched.
              const dag = graph.kind === "dag";
              const optionalTouch =
                dag && (byId.get(edge.from)?.node.optional || byId.get(edge.to)?.node.optional);
              return (
                <path
                  key={`${edge.kind}-${edge.from}-${edge.to}`}
                  data-testid="roadmap-edge"
                  data-edge-from={edge.from}
                  data-edge-to={edge.to}
                  d={planGraphEdgePath(graph.kind, from, to)}
                  fill="none"
                  stroke={dag ? "hsl(var(--muted-foreground))" : "hsl(var(--border))"}
                  strokeOpacity={dag ? 0.55 : 1}
                  strokeWidth={edge.kind === "stage-connector" ? 1.5 : dag ? 1.5 : 1.25}
                  strokeDasharray={optionalTouch ? "5 4" : undefined}
                  markerEnd={dag ? "url(#roadmap-arrow)" : undefined}
                />
              );
            })}
            {Object.values(layout.boxes).map((box) => {
              const view = byId.get(box.id);
              if (!view) return null;
              const display = NODE_STATE_DISPLAY[view.state];
              const face = NODE_STATE_FACE[view.state];
              const focused = focusedId === box.id;
              const title = view.node.title.length > 18 ? `${view.node.title.slice(0, 17)}…` : view.node.title;
              const ariaLabel = view.node.optional
                ? t("plans.graphNodeAriaOptional", { node: view.node.title, state: t(display.labelKey) })
                : t("plans.graphNodeAria", { node: view.node.title, state: t(display.labelKey) });
              return (
                <g
                  key={box.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(box.id, el);
                  }}
                  data-testid="roadmap-node"
                  data-node-id={box.id}
                  data-focused={focused ? "true" : "false"}
                  role="button"
                  tabIndex={focused ? 0 : -1}
                  aria-label={ariaLabel}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={() => setHoveredId(box.id)}
                  onPointerLeave={() => setHoveredId((current) => (current === box.id ? null : current))}
                  onClick={() => {
                    setSelectedId(box.id);
                    setFocusedId(box.id);
                    setHoveredId(null);
                  }}
                  onFocus={() => setFocusedId(box.id)}
                  onKeyDown={(event) => onNodeKeyDown(event, box)}
                  className="cursor-pointer"
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={ROADMAP_NODE_W}
                    height={ROADMAP_NODE_H}
                    rx={14}
                    style={{ fill: face.fill, stroke: focused ? "var(--accent-ring)" : "hsl(var(--border-soft))" }}
                    strokeWidth={focused ? 2 : 1}
                    strokeDasharray={view.node.optional ? "6 4" : undefined}
                  />
                  {focused && (
                    <rect
                      data-testid="roadmap-node-ring"
                      x={box.x - 3}
                      y={box.y - 3}
                      width={ROADMAP_NODE_W + 6}
                      height={ROADMAP_NODE_H + 6}
                      rx={16}
                      fill="none"
                      stroke="var(--accent-ring)"
                      strokeWidth={2.5}
                    />
                  )}
                  <text
                    x={box.x + 14}
                    y={box.y + ROADMAP_NODE_H / 2 + 5}
                    fontSize={14}
                    fill={face.ink}
                    aria-hidden="true"
                  >
                    {display.glyph}
                  </text>
                  <text
                    x={box.x + 36}
                    y={box.y + ROADMAP_NODE_H / 2 + 5}
                    fontSize={12.5}
                    fontWeight={600}
                    fill="hsl(var(--foreground))"
                  >
                    {title}
                  </text>
                  {/* The optional marker line (AD-9 not-color-only): a
                      dashed-outline chip + the word, under the title. */}
                  {view.node.optional && (
                    <g data-testid="roadmap-node-optional">
                      <rect
                        x={box.x + 36}
                        y={box.y + ROADMAP_NODE_H - 20}
                        width={8}
                        height={8}
                        rx={2}
                        fill="none"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.2}
                        strokeDasharray="3 2"
                      />
                      <text
                        x={box.x + 49}
                        y={box.y + ROADMAP_NODE_H - 12.5}
                        fontSize={10}
                        fill="hsl(var(--muted-foreground))"
                      >
                        {t("plans.nodeOptional")}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* The hover tooltip (epic-16 T3): title + state (+ optional marker),
            pinned to the node's screen position, never intercepting the pan. */}
        {hovered && hoveredBox && (
          <div
            role="tooltip"
            data-testid="roadmap-tooltip"
            className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border border-border-soft bg-popover px-2.5 py-1.5 text-xs leading-[1.5] shadow-raised"
            style={{ left: pan.x + hoveredBox.x * zoom + 12, top: Math.max(4, pan.y + hoveredBox.y * zoom - 38) }}
          >
            <span className="font-semibold text-foreground">{hovered.node.title}</span>
            <span className="text-muted-foreground">
              {` · ${t(NODE_STATE_DISPLAY[hovered.state].labelKey)}`}
              {hovered.node.optional && ` · ${t("plans.nodeOptional")}`}
            </span>
          </div>
        )}

        {/* The toolbar floats INSIDE the pan-capturing canvas — without
            stopping the pointerdown here, the canvas grabs pointer capture and
            real-Chromium retargets the pointerup to the canvas, so the
            buttons' onClick never fires (and a press-drag on a button pans).
            Mirrors the node <g>'s stopPropagation (review finding 1). */}
        <div
          className="absolute top-2.5 right-2.5 flex flex-col gap-1.5"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            data-testid="roadmap-zoom-in"
            aria-label={t("plans.graphZoomIn")}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="roadmap-zoom-out"
            aria-label={t("plans.graphZoomOut")}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="roadmap-fit"
            aria-label={t("plans.graphFitView")}
            onClick={fitView}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="roadmap-zoom-reset"
            aria-label={t("plans.graphZoomReset")}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft bg-background text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
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
              <div className="mt-1 flex items-center gap-2.5">
                <NodeStateBadge state={selected.state} />
                {selected.node.optional && (
                  <span
                    data-testid="roadmap-node-optional-badge"
                    className="pill pill-muted border-dashed flex-none"
                  >
                    {t("plans.nodeOptional")}
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
                <NodeActions
                  targets={selectedTargets}
                  failed={mappingsFailed}
                  planId={planId}
                  nodeId={selected.node.id}
                  nodeTitle={selected.node.title}
                />
              </div>
              {mappings === undefined && !mappingsFailed && (
                <p className="mt-3 text-xs text-muted-foreground">{t("plans.graphActionsPending")}</p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
