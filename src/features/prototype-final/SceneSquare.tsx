/**
 * PROTOTYPE scene 12/14 — Square 广场 (FR-38/39, Phase 2): browse Public
 * Study Plans, preview structure, adopt (= fork with attribution, OQ-12).
 * NFR-7 boundary stated on the surface: structure shared, content never.
 */
import { useState } from "react";
import { Check, Copy, GitFork, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useL, squarePlans, type ProtoState } from "./demo";

export default function SceneSquare({ state }: { state: ProtoState }) {
  const l = useL();
  const [adopted, setAdopted] = useState<Set<string>>(new Set(squarePlans.filter((p) => p.adopted).map((p) => p.id)));

  const adopt = (id: string) => {
    setAdopted((prev) => new Set(prev).add(id));
    toast(l("已 fork 为你的计划 · 原作者署名保留（OQ-12）", "Forked into your plans · original author credited (OQ-12)"));
  };

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{l("广场 · 发现公开计划", "Square · discover public plans")}</p>
          <h1 className="page-title mt-1.5">{l("站在别人的结构上开始", "Start from someone else's structure")}</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => state.go("plans")}>
          {l("去我的计划", "My plans")}
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
        <GitFork className="w-3.5 h-3.5 flex-none" aria-hidden="true" />
        {l(
          "只分享结构——节点与阶段；任何人的材料、划线、掌握度永不外露（NFR-7）。采纳 = fork，附原作者署名。",
          "Structure only — nodes and stages; anyone's materials, highlights and mastery are never exposed (NFR-7). Adopt = fork, with attribution.",
        )}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        {squarePlans.map((plan) => {
          const got = adopted.has(plan.id);
          return (
            <div key={plan.id} className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{plan.topic}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" aria-hidden="true" /> {plan.author} · {plan.forks} {l("次采纳", "adoptions")}
                  </p>
                </div>
                {got && <span className="pill pill-mastered flex-none">{l("已在我的计划", "In my plans")}</span>}
              </div>

              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-3">{plan.stages}</p>
              <div className="mt-1.5 space-y-1">
                {plan.nodePreview.slice(0, 4).map((n) => (
                  <p key={n} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span aria-hidden="true" className="text-[10px]">○</span> {n}
                  </p>
                ))}
                {plan.nodePreview.length > 4 && (
                  <p className="text-[11px] text-muted-foreground">+{plan.nodePreview.length - 4} {l("个节点…", "more nodes…")}</p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border-soft">
                {got ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs pointer-events-none">
                    <Check className="w-3.5 h-3.5 mr-1" /> {l("已 fork · 附上你的材料开学", "Forked · attach your materials")}
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 text-xs" onClick={() => adopt(plan.id)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> {l("采纳为我的计划", "Adopt as my plan")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
