/**
 * The roadmap graph (epic P2-10 T4, FR-5; delta decision 1 — custom SVG over
 * the pure roadmap-layout, ZERO new dependencies, NFR-6; the data model's
 * total `order` + stage labels make deterministic columns the
 * structure-faithful rendering). The UX spine names the graph "a view tab
 * inside Plan Home" (EXPERIENCE.md Phase-2 positions); the node detail is a
 * SIDE SHEET (the spine is silent on panel-vs-sheet — recorded in the ticket:
 * a sheet keeps the pannable canvas context visible, matching the scaffold's
 * floating-layer posture, DESIGN.md).
 *
 * Nodes render the T3 state vocabulary on the face (glyph + tint, AD-9
 * never-color-only — server fields only, AD-14). Click a node → the detail
 * side sheet: the SAME NodeStateBadge + title + score + the T3 click-through
 * actions via the shared NodeActions (confirmed mapping → the reader through
 * the REAL anchor builders; else / in-flight-failure → the node Quick Test).
 * Keyboard (AD-9): every node is a focusable `g[role=button]` with an
 * aria-label, roving tabindex (up/down within a column, left/right across
 * columns, clamped), Enter/Space opens the detail, Esc closes; the focused
 * node carries the semantic-token focus ring. Pan = pointer drag on the
 * canvas; zoom = buttons + ctrl/cmd+wheel (native non-passive listener),
 * clamped. The app's motion setting (ThemeContext, like every surface) and
 * prefers-reduced-motion disable the smooth transform transitions.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
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
  roadmapEdgePath,
  roadmapLayout,
  ROADMAP_NODE_H,
  ROADMAP_NODE_W,
  type RoadmapBox,
} from "./roadmap-layout";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

export default function RoadmapGraph({
  planId,
  views,
  materials,
  mappings,
  mappingsFailed = false,
}: {
  planId: string;
  /** The plan's node rows, already shaped by nodeRowViews (score/state server fields, AD-14). */
  views: NodeRowView[];
  materials: MaterialView[];
  /** The plan-scope batch mapping rows; undefined while the read is in flight. */
  mappings?: MaterialNodeMappingView[];
  mappingsFailed?: boolean;
}) {
  const { t } = useLanguage();
  const { reduceMotion } = useTheme();
  const layout = useMemo(
    () => roadmapLayout(views.map((view) => ({ id: view.node.id, order: view.node.order, stage: view.node.stage }))),
    [views],
  );
  const byId = useMemo(() => new Map(views.map((view) => [view.node.id, view])), [views]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(() => layout.columns[0]?.nodeIds[0] ?? null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, SVGElement>());

  // ctrl/cmd+wheel zoom rides a NATIVE non-passive listener — React's root
  // wheel listener is passive and preventDefault (blocking the browser's
  // page zoom) would be swallowed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

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

  const focusNode = (box: RoadmapBox) => {
    setFocusedId(box.id);
    const el = nodeRefs.current.get(box.id);
    if (el && typeof el.focus === "function") el.focus();
  };

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

  return (
    <div>
      <div
        ref={canvasRef}
        data-testid="roadmap-canvas"
        data-motion={reduceMotion ? "off" : "on"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[440px] overflow-hidden rounded-2xl border border-border-soft bg-card shadow-raised cursor-grab active:cursor-grabbing"
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
            {layout.edges.map((edge) => {
              const from = layout.boxes[edge.from];
              const to = layout.boxes[edge.to];
              if (!from || !to) return null;
              return (
                <path
                  key={`${edge.kind}-${edge.from}-${edge.to}`}
                  d={roadmapEdgePath(from, to)}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={edge.kind === "stage-connector" ? 1.5 : 1.25}
                />
              );
            })}
            {layout.columns.map((column) => (
              <text
                key={`header-${column.nodeIds[0] ?? column.x}`}
                data-testid="roadmap-stage-label"
                x={column.x + 2}
                y={12 + 14}
                fontSize={11}
                fontWeight={600}
                fill="hsl(var(--muted-foreground))"
              >
                {column.stage ?? t("plans.stageUngrouped")}
              </text>
            ))}
            {Object.values(layout.boxes).map((box) => {
              const view = byId.get(box.id);
              if (!view) return null;
              const display = NODE_STATE_DISPLAY[view.state];
              const face = NODE_STATE_FACE[view.state];
              const focused = focusedId === box.id;
              const title = view.node.title.length > 18 ? `${view.node.title.slice(0, 17)}…` : view.node.title;
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
                  aria-label={t("plans.graphNodeAria", { node: view.node.title, state: t(display.labelKey) })}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setSelectedId(box.id);
                    setFocusedId(box.id);
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
                </g>
              );
            })}
          </svg>
        </div>

        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
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
                <span className="font-display font-bold tabular-nums text-sm text-muted-foreground">
                  {selected.hasEvidence ? `${selected.score}%` : "—"}
                </span>
              </div>
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
