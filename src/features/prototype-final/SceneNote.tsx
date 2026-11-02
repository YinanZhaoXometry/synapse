/**
 * PROTOTYPE scene 11/14 — AI Note (FR-40/FR-22, Phase 2): a companion-authored
 * Markdown study document, weak-spot targeted (scope auto-picked from the two
 * lowest-scoring nodes — real numbers from the shared evidence), with AI-inserted
 * charts at comprehension-critical points and an export path.
 */
import { Download, ImagePlus, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useL, demoNote, demoNodes, type ProtoState } from "./demo";
import { nodeRowViews } from "@/features/plans/display-shaping";

/** Tiny inline SVG charts standing in for AI visual enrichment (FR-40). */
function GradientChart() {
  const bars = [
    { label: "err=2.0", mse: 4, ce: 88 },
    { label: "err=1.0", mse: 12, ce: 74 },
    { label: "err=0.5", mse: 28, ce: 41 },
    { label: "err=0.1", mse: 18, ce: 12 },
  ];
  return (
    <svg viewBox="0 0 300 110" className="w-full max-w-[360px]" role="img" aria-label="MSE vs cross-entropy gradient magnitude">
      {bars.map((b, i) => (
        <g key={b.label} transform={`translate(${16 + i * 72}, 0)`}>
          <rect x="0" y="90 - b.mse * 0.9" width="20" height={b.mse * 0.9} rx="3" fill="hsl(var(--muted-foreground) / 0.4)" />
          <rect x="26" y={90 - b.ce * 0.9} width="20" height={b.ce * 0.9} rx="3" fill="url(#note-grad)" />
          <text x="23" y="105" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">{b.label}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="note-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(var(--grad-b))" />
          <stop offset="100%" stopColor="hsl(var(--grad-a))" />
        </linearGradient>
      </defs>
      <text x="10" y="12" fontSize="9" fill="hsl(var(--muted-foreground))">灰=MSE 梯度 · 彩=交叉熵梯度</text>
    </svg>
  );
}

function FlowChart() {
  const steps = ["错题", "定位原文 p.3", "重测", "证据回血"];
  return (
    <svg viewBox="0 0 340 44" className="w-full max-w-[400px]" role="img" aria-label="mistake retry loop">
      {steps.map((s, i) => (
        <g key={s}>
          <rect x={i * 88} y="8" width="72" height="28" rx="8" fill="hsl(var(--uncovered-fill))" stroke="hsl(var(--foreground) / 0.12)" />
          <text x={i * 88 + 36} y="26" textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--foreground))">{s}</text>
          {i < steps.length - 1 && (
            <path d={`M ${i * 88 + 72} 22 L ${i * 88 + 86} 22`} stroke="hsl(var(--foreground) / 0.3)" strokeWidth="1.5" markerEnd="url(#note-arrow)" />
          )}
        </g>
      ))}
      <defs>
        <marker id="note-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--foreground) / 0.3)" />
        </marker>
      </defs>
    </svg>
  );
}

export default function SceneNote({ state }: { state: ProtoState }) {
  const l = useL();
  const views = nodeRowViews(demoNodes.filter((n) => n.planId === "p-ml"), state.evidence);
  const weakest = views
    .filter((v) => v.hasEvidence)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return (
    <div className="p-6 md:p-8 max-w-[760px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{l("AI 笔记 · Study Note", "AI Note · Study Note")}</p>
          <h1 className="page-title mt-1.5">{demoNote.title}</h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            {l("瞄准弱项生成（FR-22）", "Weak-spot targeted (FR-22)")} ·{" "}
            {weakest.map((w) => `${w.node.title} ${w.score}%`).join(" · ")}
          </p>
        </div>
        <span className="pill pill-partial">
          <Sparkles className="w-3 h-3" aria-hidden="true" /> {l("2 分钟前生成", "generated 2 min ago")}
        </span>
      </div>

      <article className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 md:p-8 mt-4">
        <p className="text-[11px] text-muted-foreground border-b border-border-soft pb-3 mb-4">
          {l("生成自", "Generated from")}：《机器学习实战（第2版）》+ 面试笔记-算法岗.md
        </p>
        <div className="space-y-6">
          {demoNote.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display font-bold text-[15px] mb-2">{section.heading}</h2>
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-[13.5px] leading-[1.85] text-foreground/90 mb-2">{p}</p>
              ))}
              {section.chart && (
                <figure className="rounded-xl border border-border-soft bg-[var(--glass-2)] p-3.5 my-3">
                  {section.chart === "gradient" ? <GradientChart /> : <FlowChart />}
                  <figcaption className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5">
                    <ImagePlus className="w-3 h-3 flex-none" aria-hidden="true" />
                    {section.chartCaption}
                  </figcaption>
                </figure>
              )}
            </section>
          ))}
        </div>
      </article>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={() => toast(l("已导出 Markdown（原型演示）", "Exported as Markdown (prototype demo)"))}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> {l("导出 Markdown", "Export Markdown")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast(l("重新生成：按最新证据重圈弱项（原型演示）", "Regenerate: re-scopes to latest evidence (prototype demo)"))}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {l("重新生成", "Regenerate")}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {l("图表位置由 AI 选择；你也可以在指定位置请求插图（FR-40）", "Chart placement is AI-selected; you can request an annotation at a chosen spot (FR-40)")}
        </span>
      </div>
    </div>
  );
}
