/**
 * PROTOTYPE scene 4/8 — the Reader, final state: paginated document pane +
 * page-aware Companion side panel (grounded in the current page, with
 * citations) + the evidence-only marking flow: 「已懂」 is a CLAIM — it never
 * moves a score until a confirm quiz passes. Content is the seeded page-3
 * section from the demo material registry.
 */
import { useState } from "react";
import { BookMarked, Check, ChevronLeft, ChevronRight, Lightbulb, ListChecks, Quote, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useL, demoMaterials, type ProtoState } from "./demo";

const MATERIAL = demoMaterials[0];
const PAGE = MATERIAL.sections.find((s) => s.id === "page-3")!;

const PAGE_PARAGRAPHS = PAGE.text.split("\n\n");

export default function SceneReader({ state }: { state: ProtoState }) {
  const l = useL();
  const [claimed, setClaimed] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "companion"; text: string; cite?: boolean }[]>([
    {
      role: "user",
      text: l("用通俗的话解释：逻辑回归明明是分类，为什么叫「回归」？", "Explain plainly: why is logistic regression called a regression when it classifies?"),
    },
    {
      role: "companion",
      cite: true,
      text: l(
        "因为它借用了回归的外壳：先像线性回归一样算出一个连续分数 wx+b，再套 Sigmoid 把分数压成 0–1 的概率，最后按 0.5 划分类别。「回归」说的是前半段，分类是整条链路的用途。",
        "It borrows the regression shell: like linear regression it first computes a continuous score wx+b, then squashes it into a 0–1 probability with Sigmoid, and classifies at the 0.5 threshold. The 'regression' is the first half; classification is the pipeline's purpose.",
      ),
    },
  ]);
  const [draft, setDraft] = useState("");

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "companion",
          cite: true,
          text: l(
            "这一页我们刚读过：交叉熵的梯度不含 Sigmoid 导数因子，错误越大梯度越充足。想检验自己？点上面的「出题检验」。",
            "From this page: cross-entropy's gradient carries no Sigmoid-derivative factor, so bigger mistakes give bigger gradients. Want to test yourself? Try 'quiz me' above.",
          ),
        },
      ]);
    }, 600);
  };

  return (
    <div className="p-6 md:p-8 max-w-[1180px] mx-auto animate-fade-in pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{l("阅读", "Reading")} · {MATERIAL.title}</p>
          <h1 className="page-title mt-1.5 text-[22px]">{PAGE.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* evidence-only marking: claim → confirm quiz (FR-15) */}
          {claimed ? (
            <span className="flex flex-col items-end gap-1">
              <span className="pill pill-partial">
                <Check className="w-3 h-3" aria-hidden="true" /> {l("已主张 · 待小测确认", "Claimed · confirm by quiz")}
              </span>
              <span className="text-[10px] text-muted-foreground">{l("标记不计分——小测通过才计入掌握度", "Marking never scores — only quizzes do")}</span>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setClaimed(true)}>
              <BookMarked className="w-3.5 h-3.5 mr-1.5" /> {l("标记「我懂了」", "Mark as understood")}
            </Button>
          )}
          <Button size="sm" onClick={() => state.go("quiz")}>
            <ListChecks className="w-3.5 h-3.5 mr-1.5" /> {l("出题检验", "Quiz me")}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 mt-5 items-start">
        {/* document pane */}
        <div className="min-w-0">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 md:p-8">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-3 border-b border-border-soft">
              <span>{MATERIAL.title}</span>
              <span className="tabular-nums">{l("第 3 页 · 共 128 页", "Page 3 of 128")}</span>
            </div>
            <div className="py-5 space-y-4 text-[13.5px] leading-[1.85]">
              {PAGE_PARAGRAPHS.map((p, i) => (
                <p key={i} className={i === 2 ? "rounded-xl border-l-[3px] border-[var(--grad-a)] bg-[var(--accent-tint)] px-4 py-3" : ""}>
                  {p}
                </p>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {["监督学习", "交叉熵", "Sigmoid", "决策边界", "正则化"].map((term) => (
                  <span key={term} className="pill pill-muted">{term}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border-soft">
              <Button variant="ghost" size="sm" disabled>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> {l("上一页", "Previous")}
              </Button>
              <div className="flex-1 mx-4 h-1 rounded-full bg-[var(--uncovered-fill)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--grad-a)] to-[var(--grad-b)]" style={{ width: "62%" }} />
              </div>
              <Button variant="ghost" size="sm">
                {l("下一页", "Next")} <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            {l(
              "阅读进度自动记录。翻到新页面时，伴侣会带着那一页的上下文重新定位。",
              "Progress is tracked automatically. On a page turn, the Companion re-grounds itself in that page.",
            )}
          </p>
        </div>

        {/* Companion pane — page-aware */}
        <aside className="bg-card border border-border-soft rounded-2xl shadow-raised flex flex-col max-h-[70vh]">
          <div className="px-4 pt-4 pb-3 border-b border-border-soft">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--grad-a)] to-[var(--grad-b)] grid place-items-center flex-none">
                <Lightbulb className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13px] font-semibold leading-tight">{l("学习伴侣", "Companion")}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {l("已定位第 3 页 · 1,842 字", "Grounded on p.3 · 1,842 chars")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {[
                { zh: "解释这一页", en: "Explain this page" },
                { zh: "出题检验", en: "Quiz me" },
                { zh: "联系我的错题", en: "Link my mistakes" },
              ].map((chip) => (
                <button
                  key={chip.zh}
                  type="button"
                  onClick={() => chip.zh === "出题检验" && state.go("quiz")}
                  className="px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer"
                >
                  {l(chip.zh, chip.en)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] text-[13px] leading-[1.6] rounded-2xl px-3.5 py-2 ${
                  m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-[var(--glass-2)] border border-border-soft"
                }`}
              >
                <span className="whitespace-pre-wrap">{m.text}</span>
                {m.cite && m.role === "companion" && (
                  <span className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] tint-blue">
                    <Quote className="w-2.5 h-2.5" aria-hidden="true" /> {l("《机器学习实战》第 3 页", "ML in Action, p.3")}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border-soft">
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={l("问这一页的任何问题…", "Ask about this page…")}
                className="h-9 text-sm"
              />
              <Button size="sm" className="h-9 px-3" onClick={send} disabled={!draft.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {l("回答只引用你的资料；超出资料会说「资料里没有」。", "Answers cite only your materials; beyond them it says so.")}
            </p>
          </div>
        </aside>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 px-1">
        {l(
          "提示：去「测验 · 证据闭环」场景答完题，再回「计划主页」——数字真的会动。",
          "Tip: answer the quiz scene, then revisit Plan Home — the numbers really move.",
        )}
      </p>
    </div>
  );
}
