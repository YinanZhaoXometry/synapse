/**
 * PROTOTYPE scene 7/14 — Study Task (FR-37 / UJ-6): the plan-free twin.
 * One Material + its exactly-one owned node + the identical machinery
 * (reader / companion / quiz / mastery). No plan UI anywhere. Promote-to-plan
 * is the Phase-2 stretch teaser. Score/evidence marks run the real seam over
 * the shared evidence array (correct/wrong/correct → 67% partial).
 */
import { ArrowUpRight, BookOpen, FileText, Layers, ListChecks, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useL, demoNodes, demoTask, demoTaskMaterial, type ProtoState } from "./demo";
import { computeNodeScore } from "@/domain/mastery";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { nodeRowViews } from "@/features/plans/display-shaping";
import { ContractNote, MasteryRing, OutcomeMark, StateGlyph } from "@/features/plans/atoms";

export default function SceneTask({ state }: { state: ProtoState }) {
  const l = useL();
  const node = demoNodes.find((n) => n.id === demoTask.nodeId)!;
  const view = nodeRowViews([node], state.evidence)[0];
  const records = state.evidence.filter((e) => e.nodeId === node.id);

  const actions = [
    { icon: BookOpen, zh: "继续阅读", en: "Continue reading", zhD: "第 2 页 · 上次读到 48%", enD: "p.2 · left off at 48%", go: () => state.go("reader") },
    { icon: ListChecks, zh: "小测检验", en: "Quiz me", zhD: "3 题 · 全部出自这份 PDF", enD: "3 questions · all from this PDF", go: () => state.go("quiz") },
    { icon: Layers, zh: "闪卡", en: "Flashcards", zhD: "本任务 6 张 · 自评排队", enD: "6 cards · self-rated queue", go: () => state.go("review") },
    { icon: MessageCircle, zh: "问伴侣", en: "Companion", zhD: "定位到你正在读的页", enD: "Grounded on your current page", go: () => state.go("reader") },
  ];

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto animate-fade-in pb-24">
      <p className="eyebrow">{l("学习任务 · 无需计划", "Study Task · no plan needed")}</p>
      <h1 className="page-title mt-1.5">{node.title}</h1>
      <p className="text-xs text-muted-foreground mt-1">
        {l("一份文档，今晚搞懂——不建计划，机械与计划内学习完全一致。", "One document, understood tonight — no plan; machinery identical to in-plan study.")}
      </p>

      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5 mt-4 flex flex-wrap items-center gap-5">
        <MasteryRing value={computeNodeScore(records)} size={72} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StateGlyph state={view.state} />
            <span className="text-xs text-muted-foreground">
              {records.length} {l("条证据 · 单节点任务", "evidence records · single-node task")}
            </span>
          </div>
          <p className="text-sm font-medium mt-2 flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
            {demoTaskMaterial.title}
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-none">
              {demoTaskMaterial.kind.toUpperCase()} · {(demoTaskMaterial.sizeBytes / 1e6).toFixed(1)}MB
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {l("3 小节已解析 · 阅读进度 48%（第 2 页）", "3 sections parsed · reading at 48% (p.2)")}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label={l("查看证据", "View evidence")}>
              <Sparkles className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 text-xs">
            <p className="font-semibold mb-2">{node.title}</p>
            <div className="flex items-center gap-1.5 mb-2">
              {view.lastOutcomes.map((o, i) => (
                <OutcomeMark key={i} outcome={o} />
              ))}
            </div>
            <p className="text-muted-foreground leading-[1.5]">
              {l(
                `分数 = 最近 ${MASTERY_CONFIG.window} 次证据均值；与计划内节点同一套规则。`,
                `Score = mean of last ${MASTERY_CONFIG.window} evidence; same rules as in-plan nodes.`,
              )}
            </p>
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="outline" onClick={() => toast(l("升级为 Study Plan —— Phase 2 功能（原型演示）", "Promote to Study Plan — Phase 2 (prototype demo)"))}>
          <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> {l("升级为计划", "Promote to plan")}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        {actions.map((a) => (
          <button
            key={a.zh}
            type="button"
            onClick={a.go}
            className="text-left rounded-xl border border-border-soft bg-card p-3.5 hover:bg-[var(--glass-2)] transition-colors cursor-pointer"
          >
            <a.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
            <p className="text-[13px] font-semibold mt-1.5">{l(a.zh, a.en)}</p>
            <p className="text-[10px] text-muted-foreground">{l(a.zhD, a.enD)}</p>
          </button>
        ))}
      </div>

      <ContractNote>
        {l(
          "Study Task = 同一套机械、零计划开销；UJ-6：她只想今晚搞懂一篇论文。",
          "Study Task = identical machinery, zero plan ceremony; UJ-6: she just wants one paper understood tonight.",
        )}
      </ContractNote>
    </div>
  );
}
