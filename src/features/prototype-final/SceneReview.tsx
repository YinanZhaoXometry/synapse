/**
 * PROTOTYPE scene 7/8 — the practice hubs: Flashcards (flip + self-rating;
 * ratings only reorder the queue — never mastery) and Mistakes (every entry
 * carries its source location; forfeits honestly labelled as no-credit).
 */
import { useState } from "react";
import { ArrowUpRight, Eye, NotebookPen, RotateCcw, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useL, demoFlashcards, demoMistakes, demoNodes, type ProtoState } from "./demo";

export default function SceneReview({ state }: { state: ProtoState }) {
  const l = useL();
  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto animate-fade-in pb-24">
      <p className="eyebrow">{l("练习", "Practice")}</p>
      <h1 className="page-title mt-1.5">{l("闪卡 & 错题本", "Flashcards & Mistakes")}</h1>

      <Tabs defaultValue="cards" className="mt-5">
        <TabsList className="bg-[var(--glass-2)]">
          <TabsTrigger value="cards">{l("闪卡复习", "Flashcards")} · 12</TabsTrigger>
          <TabsTrigger value="mistakes">{l("错题本", "Mistakes")} · {demoMistakes.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-4">
          <Flashcards />
        </TabsContent>

        <TabsContent value="mistakes" className="mt-4">
          <Mistakes state={state} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Flashcards() {
  const l = useL();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(0);
  const card = demoFlashcards[index];

  const rate = () => {
    setFlipped(false);
    setRated((n) => n + 1);
    setIndex((i) => (i + 1) % demoFlashcards.length);
    toast(l("已排入复习队列（自评不影响掌握度）", "Queued for review (self-rating never touches mastery)"));
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => e.key === "Enter" && setFlipped((f) => !f)}
        className="min-h-[220px] rounded-2xl border border-border-soft shadow-raised bg-card p-8 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-transform active:scale-[0.99]"
      >
        <span className="pill pill-muted mb-4">{l("第 ", "Card ")}{index + 1}/{demoFlashcards.length}</span>
        {!flipped ? (
          <p className="font-display font-semibold text-lg leading-[1.6] max-w-[520px]">{card.front}</p>
        ) : (
          <>
            <p className="text-[13.5px] leading-[1.8] max-w-[540px]">{card.back}</p>
            <span className="text-[10px] text-muted-foreground mt-4">
              {l("来源：《机器学习实战》/ 面试笔记", "Source: ML in Action / interview notes")}
            </span>
          </>
        )}
        <span className="text-[11px] text-muted-foreground mt-5">{flipped ? l("点按收起", "Tap to flip back") : l("点按翻面", "Tap to flip")}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { label: l("不熟", "Hard"), cls: "tint-danger" },
          { label: l("模糊", "Medium"), cls: "tint-amber" },
          { label: l("会了", "Easy"), cls: "tint-green" },
        ].map((r) => (
          <button key={r.label} type="button" onClick={rate} className={`rounded-xl border border-border-soft py-2.5 text-[13px] font-semibold cursor-pointer ${r.cls}`}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] leading-[1.6] text-muted-foreground mt-2.5 px-1">
        <ScanFace className="w-3 h-3 mt-[2px] flex-none" aria-hidden="true" />
        {l(
          `已自评 ${rated} 张 · 自评只决定复习排程；掌握度只认小测证据，闪卡永远不加分。`,
          `${rated} rated · self-rating only schedules reviews; mastery counts quiz evidence only — flashcards never add score.`,
        )}
      </p>
    </div>
  );
}

function Mistakes({ state }: { state: ProtoState }) {
  const l = useL();
  return (
    <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
      {demoMistakes.map((m) => {
        const node = demoNodes.find((n) => n.id === m.nodeId);
        return (
          <div key={m.id} className="px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-lg grid place-items-center flex-none ${m.forfeited ? "tint-amber" : "tint-danger"}`}>
                {m.forfeited ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">
                  {m.nodeId === "n-sup"
                    ? l("训练逻辑回归通常最小化哪种损失？", "Which loss does logistic regression usually minimize?")
                    : l("精确率与召回率的权衡 + 保召回场景", "Precision/recall trade-off + a recall-first scenario")}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {l("你的答案", "Your answer")}：{m.userAnswer}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      m.sourceLocation.kind === "pdf"
                        ? l(`跳转《机器学习实战》第 ${m.sourceLocation.page} 页（原型演示）`, `Jump to ML in Action p.${m.sourceLocation.page} (prototype)`)
                        : l("跳转笔记对应小节（原型演示）", "Jump to the notes section (prototype)"),
                    )
                  }
                  className="pill tint-blue cursor-pointer"
                >
                  <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  {m.sourceLocation.kind === "pdf" ? `p.${m.sourceLocation.page}` : "§"}
                </button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => state.go("quiz")}>
                  <RotateCcw className="w-3 h-3 mr-1" /> {l("重练", "Retry")}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 ml-[38px]">
              {node?.title} ·{" "}
              {m.forfeited
                ? l("「看答案」= 放弃：计错、不给掌握度加分", "'Show answer' = forfeit: graded wrong, no mastery credit")
                : l("答错计为一条错误证据 · 重练答对可回血", "A wrong answer is one evidence record · retrying correctly heals it")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
