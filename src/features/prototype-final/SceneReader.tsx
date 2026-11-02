/**
 * PROTOTYPE scene 4/8 — the Reader, final state: paginated document pane +
 * page-aware Companion side panel (grounded in the current page, with
 * citations) + the evidence-only marking flow: 「已懂」 is a CLAIM — it never
 * moves a score until a confirm quiz passes. Content is the seeded page-3
 * section from the demo material registry.
 */
import { useState, type CSSProperties } from "react";
import { BookMarked, Check, ChevronLeft, ChevronRight, Highlighter, Lightbulb, ListChecks, Quote, RotateCcw, Send, Wand2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useL, demoMaterials, studyFocusItems, type ProtoState } from "./demo";

const MATERIAL = demoMaterials[0];
const PAGE = MATERIAL.sections.find((s) => s.id === "page-3")!;

const PAGE_PARAGRAPHS = PAGE.text.split("\n\n");

/** Highlighter colors (FR-16) — content semantics: yellow / blue / green markers. */
const HL_STYLE: Record<number, CSSProperties> = {
  1: { background: "rgba(250,204,21,0.22)", borderLeft: "3px solid rgba(250,204,21,0.8)", paddingLeft: "12px", borderRadius: "8px" },
  2: { background: "rgba(96,165,250,0.18)", borderLeft: "3px solid rgba(96,165,250,0.8)", paddingLeft: "12px", borderRadius: "8px" },
  3: { background: "rgba(74,222,128,0.18)", borderLeft: "3px solid rgba(74,222,128,0.8)", paddingLeft: "12px", borderRadius: "8px" },
};

export default function SceneReader({ state }: { state: ProtoState }) {
  const l = useL();
  const [claimed, setClaimed] = useState(false);
  const [highlights, setHighlights] = useState<Record<number, number>>({ 1: 1 }); // seed: paragraph 2 pre-highlighted yellow
  const [focusOpen, setFocusOpen] = useState(false);
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

  const hlCount = Object.values(highlights).filter((v) => v > 0).length;
  const cycleHl = (i: number) => setHighlights((h) => ({ ...h, [i]: ((h[i] ?? 0) % 3) + 1 }));
  const clearHl = (i: number) => setHighlights((h) => ({ ...h, [i]: 0 }));

  const askAbout = (i: number) => {
    const excerpt = PAGE_PARAGRAPHS[i].slice(0, 42);
    setMessages((m) => [
      ...m,
      { role: "user", text: l(`解释这段：「${excerpt}…」`, `Explain this: "${excerpt}…"`) },
      {
        role: "companion",
        cite: true,
        text: l(
          "先给你一个思考角度（NFR-2 先引导）：这段在对比两种损失的梯度行为——想想「错误很大时，各自梯度会发生什么」？想直接对答案的话再问一次。（原型演示：真实回答由服务端 AI 生成）",
          "A thinking angle first (NFR-2 hint-first): this paragraph contrasts two losses' gradient behavior — ask yourself 'what happens to each gradient when the error is large?' Ask again if you want the direct answer. (Prototype: real answers are server-side AI)",
        ),
      },
    ]);
  };

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
          <span className="pill pill-muted cursor-help flex-none" title={l("点击段落划线：黄 → 蓝 → 绿 → 取消", "Click a paragraph to highlight: yellow → blue → green → clear")}>
            <Highlighter className="w-3 h-3" aria-hidden="true" /> {l("划线", "Marks")} {hlCount}
          </span>
          <Button size="sm" variant="outline" onClick={() => setFocusOpen((v) => !v)}>
            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> {l("学习重点", "Study Focus")}
          </Button>
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

      {/* Study Focus panel (FR-17): core items derived from the highlights */}
      {focusOpen && (
        <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 mt-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">{l("学习重点 · Study Focus", "Study Focus")}</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> {l("随划线重新生成", "Regenerate from marks")}
            </button>
          </div>
          <div className="space-y-2 mt-3">
            {studyFocusItems.map((item) => (
              <div key={item.text} className="flex items-center gap-2.5 text-[13px]">
                <Zap className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
                <span className="flex-1">{item.text}</span>
                <span className="pill pill-muted flex-none">{item.source}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            {l(`由你的 ${hlCount} 处划线生成（FR-17）——AI 读取高亮与下划线，提炼这份材料的核心。`, `Generated from your ${hlCount} highlights (FR-17) — the AI reads marks and distills this material's core.`)}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 mt-5 items-start">
        {/* document pane */}
        <div className="min-w-0">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 md:p-8">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-3 border-b border-border-soft">
              <span>{MATERIAL.title}</span>
              <span className="tabular-nums">{l("第 3 页 · 共 128 页", "Page 3 of 128")}</span>
            </div>
            <div className="py-5 space-y-4 text-[13.5px] leading-[1.85]">
              {PAGE_PARAGRAPHS.map((p, i) => {
                const hl = highlights[i] ?? 0;
                return (
                  <div key={i} className="relative group">
                    <p
                      role="button"
                      tabIndex={0}
                      onClick={() => cycleHl(i)}
                      onKeyDown={(e) => e.key === "Enter" && cycleHl(i)}
                      title={l("点击划线 / 换色；再点取消", "Click to highlight / change color; click to clear")}
                      className={`cursor-pointer rounded-lg -mx-2 px-2 py-1 transition-colors ${hl ? "" : "hover:bg-[var(--glass-2)]"}`}
                      style={hl ? HL_STYLE[hl] : undefined}
                    >
                      {p}
                    </p>
                    {hl > 0 && (
                      <span className="absolute -top-1.5 right-0 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => askAbout(i)}
                          className="pill tint-coral cursor-pointer text-[10px]"
                        >
                          <Lightbulb className="w-2.5 h-2.5" aria-hidden="true" /> {l("问伴侣", "Ask")}
                        </button>
                        <button
                          type="button"
                          onClick={() => state.go("quiz")}
                          className="pill tint-blue cursor-pointer text-[10px]"
                        >
                          <ListChecks className="w-2.5 h-2.5" aria-hidden="true" /> {l("速测", "Test")}
                        </button>
                        <button
                          type="button"
                          onClick={() => clearHl(i)}
                          className="pill pill-muted cursor-pointer text-[10px]"
                        >
                          {l("清除", "Clear")}
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
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
