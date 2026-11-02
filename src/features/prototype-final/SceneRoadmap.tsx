/**
 * PROTOTYPE scene 4/14 — Roadmap graph (FR-5/6/7, Phase 2): the plan as an
 * interactive roadmap.sh-style node graph. Stage columns, sequence edges,
 * mastery states (glyph + tint, never color alone), click-through into the
 * reader. Node states recompute live from the shared evidence array — answer
 * the quiz scene and this graph lights up.
 */
import { demoNodes, demoPlans, useL, type ProtoState } from "./demo";
import { nodeRowViews, stageGroups, planCardMetrics } from "@/features/plans/display-shaping";
import { MasteryRing, StateGlyph } from "@/features/plans/atoms";
import type { NodeState } from "@/domain/entities";

const COL_W = 172;
const NODE_W = 150;
const NODE_H = 46;
const GAP_Y = 14;
const TOP = 56;

const STATE_FILL: Record<NodeState, string> = {
  mastered: "hsl(var(--mastered-tint))",
  partial: "hsl(var(--partial-tint))",
  uncovered: "hsl(var(--uncovered-fill))",
};
const STATE_STROKE: Record<NodeState, string> = {
  mastered: "rgba(57,172,134,0.45)",
  partial: "rgba(232,110,48,0.4)",
  uncovered: "rgba(127,127,127,0.25)",
};
const STATE_MARK: Record<NodeState, string> = { mastered: "✦", partial: "◐", uncovered: "○" };

export default function SceneRoadmap({ state }: { state: ProtoState }) {
  const l = useL();
  const plan = demoPlans[0];
  const nodes = demoNodes.filter((n) => n.planId === plan.id);
  const views = nodeRowViews(nodes, state.evidence);
  const groups = stageGroups(views);
  const metrics = planCardMetrics(nodes, state.evidence);

  const colHeight = Math.max(...groups.map((g) => g.rows.length));
  const width = 24 + groups.length * COL_W;
  const height = TOP + colHeight * (NODE_H + GAP_Y) + 8;

  // layout: column x, per-row y
  const pos = new Map<string, { x: number; y: number }>();
  groups.forEach((g, ci) => {
    g.rows.forEach((row, ri) => {
      pos.set(row.node.id, { x: 12 + ci * COL_W, y: TOP + ri * (NODE_H + GAP_Y) });
    });
  });

  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) =>
    `M ${from.x + NODE_W} ${from.y + NODE_H / 2} C ${from.x + NODE_W + 42} ${from.y + NODE_H / 2}, ${to.x - 42} ${to.y + NODE_H / 2}, ${to.x} ${to.y + NODE_H / 2}`;

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{l("路线图 · Roadmap", "Roadmap")}</p>
          <h1 className="page-title mt-1.5">{plan.topic}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {l("结构先行的具象化：节点随证据点亮 · 点击节点进入阅读（FR-7）", "Structure made visible: nodes light up with evidence · click a node to read (FR-7)")}
          </p>
        </div>
        <MasteryRing value={metrics.rollup} size={64} />
      </div>

      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 mt-4 overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label={l("计划路线图", "Plan roadmap")} className="mx-auto block">
          {/* stage labels */}
          {groups.map((g, ci) => (
            <text
              key={g.stage ?? ci}
              x={12 + ci * COL_W + NODE_W / 2}
              y={30}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.14em"
              fill="hsl(var(--muted-foreground))"
              className="uppercase"
            >
              {g.stage ?? l("未分组", "Ungrouped")}
            </text>
          ))}

          {/* sequence edges (roadmap.sh style: consecutive stages fully connected) */}
          {groups.slice(1).map((g, ci) =>
            g.rows.map((row) => {
              const to = pos.get(row.node.id)!;
              const prev = groups[ci];
              return prev.rows.map((prevRow) => {
                const from = pos.get(prevRow.node.id)!;
                return (
                  <path
                    key={`${prevRow.node.id}-${row.node.id}`}
                    d={edge(from, to)}
                    fill="none"
                    stroke="hsl(var(--foreground) / 0.14)"
                    strokeWidth="1.5"
                  />
                );
              });
            }),
          )}

          {/* nodes */}
          {groups.flatMap((g) =>
            g.rows.map((view) => {
              const p = pos.get(view.node.id)!;
              return (
                <g
                  key={view.node.id}
                  transform={`translate(${p.x}, ${p.y})`}
                  className="cursor-pointer"
                  onClick={() => state.go("reader")}
                >
                  <title>{l("点击进入阅读", "Click to open the reader")}</title>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="12"
                    fill={STATE_FILL[view.state]}
                    stroke={STATE_STROKE[view.state]}
                    strokeWidth="1.5"
                  />
                  <text x="12" y="20" fontSize="11" fill="hsl(var(--foreground))" fontWeight="600">
                    <tspan aria-hidden="true">{STATE_MARK[view.state]} </tspan>
                    {view.node.title.length > 9 ? `${view.node.title.slice(0, 9)}…` : view.node.title}
                  </text>
                  <text x="12" y="35" fontSize="10" fill="hsl(var(--muted-foreground))" className="tabular-nums">
                    {view.hasEvidence ? `${view.score}%` : l("未开始", "not started")}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <StateGlyph state="mastered" />
        <StateGlyph state="partial" />
        <StateGlyph state="uncovered" />
        <span className="text-[11px] text-muted-foreground ml-2">
          {l(
            "「进阶/应用」阶段全灰是诚实的——还没有任何证据。去测验场景答一轮，回来这里会变。",
            "The 进阶/应用 stages being all grey is honest — zero evidence there yet. Answer a quiz round and revisit this graph.",
          )}
        </span>
      </div>
    </div>
  );
}
