/**
 * PROTOTYPE Variant A — 「Spine 基线」: EXPERIENCE.md IA table as written.
 * Plans Home = composed page (empty state = chat card, returning = continue hero + card grid);
 * Plan Home = two-zone dashboard (nodes+materials left, actions+activity right).
 */
import { useState } from "react";
import { ArrowLeft, FileText, Layers, ListChecks, MessageCircle, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContractNote, MasteryRing, PrototypeHint, StateGlyph, StreakChip, useHint, useLl } from "./atoms";
import { useCreationChat } from "./useCreationChat";
import { RECENT_ACTIVITY, STREAK, STUB_PLANS, rollupOf, type StubNode, type StubPlan } from "./stub-data";
import type { StudyPlan } from "@/domain/entities";

const OUTCOME_CLS = {
  correct: "tint-green",
  partial: "tint-amber",
  wrong: "bg-[rgba(168,50,50,0.1)] text-danger-ink",
} as const;
const OUTCOME_MARK = { correct: "●", partial: "◐", wrong: "✕" } as const;

export default function VariantA() {
  const { language } = useLanguage();
  const ll = useLl();
  const [plans, setPlans] = useState<StubPlan[]>(STUB_PLANS);
  const [screen, setScreen] = useState<{ kind: "home" } | { kind: "plan"; id: string }>({ kind: "home" });
  const [homeMode, setHomeMode] = useState<"returning" | "empty">("returning");
  const chat = useCreationChat(language);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const { hint, showHint } = useHint();
  const [topicDraft, setTopicDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");

  const addPlan = (plan: StudyPlan, nodes: { id: string; stage: string | null; title: string; order: number }[]) => {
    setPlans(prev => [
      { plan, materials: [], lastActivity: ll("刚刚", "just now"), nodes: nodes.map(n => ({ ...n, planId: plan.id, taskId: null, evidence: [], score: 0, state: "uncovered" as const })) },
      ...prev,
    ]);
  };

  const confirmCreate = () => {
    const { plan, nodes } = chat.buildPlan(renames);
    addPlan(plan, nodes);
    chat.reset();
    setRenames({});
    setScreen({ kind: "plan", id: plan.id });
  };

  // ---------- Plan Home ----------
  if (screen.kind === "plan") {
    const sp = plans.find(p => p.plan.id === screen.id);
    if (!sp) return null;
    const stages = [...new Set(sp.nodes.map(n => n.stage ?? "—"))];
    const rollup = rollupOf(sp.nodes);
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        <PrototypeHint text={hint} />
        <button type="button" onClick={() => setScreen({ kind: "home" })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> {ll("所有计划", "All plans")}
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
          <div>
            <p className="eyebrow">{ll("学习计划", "Study Plan")}</p>
            <h1 className="page-title mt-1.5">{sp.plan.topic}</h1>
            {sp.plan.goal && <p className="text-xs text-muted-foreground mt-1">{ll("目标", "Goal")}：{sp.plan.goal}</p>}
          </div>
          <div className="flex items-center gap-4">
            <StreakChip days={STREAK} />
            <div className="text-right">
              <MasteryRing value={rollup} size={72} />
              <ContractNote>{ll("Rollup = 各节点均分，未覆盖按 0 计入（ADR-0001）", "Rollup = mean of node scores; uncovered counts 0 (ADR-0001)")}</ContractNote>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-5 items-start">
          {/* left: nodes + materials */}
          <div className="min-w-0">
            {stages.map(stage => (
              <section key={stage} className="mb-5">
                <h2 className="eyebrow mb-2">{stage}</h2>
                <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                  {sp.nodes.filter(n => (n.stage ?? "—") === stage).map(n => (
                    <div key={n.id} className="flex items-center gap-3 px-4 py-3">
                      <StateGlyph state={n.state} />
                      <span className="text-sm font-medium truncate flex-1">{n.title}</span>
                      <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">
                        {n.evidence.length > 0 ? `${n.score}%` : "—"}
                      </span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" aria-label={ll("查看证据", "view evidence")}
                            className="text-muted-foreground hover:text-foreground cursor-pointer">
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 text-xs">
                          <p className="font-semibold mb-2">{n.title}</p>
                          <div className="flex items-center gap-1.5 mb-2">
                            {n.evidence.length === 0 && <span className="text-muted-foreground">{ll("还没有证据", "no evidence yet")}</span>}
                            {n.evidence.slice(-5).map(e => (
                              <span key={e.id} className={`w-5 h-5 grid place-items-center rounded-full text-[10px] ${OUTCOME_CLS[e.outcome]}`} title={e.outcome}>
                                {OUTCOME_MARK[e.outcome]}
                              </span>
                            ))}
                          </div>
                          <p className="text-muted-foreground leading-[1.5]">
                            {ll("分数 = 最近 5 次均分（correct 1 / partial 0.5 / wrong 0）；≥80 且 ≥3 次证据 → 已掌握。", "Score = mean of last 5 (correct 1 / partial .5 / wrong 0); ≥80 with ≥3 records → mastered.")}
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="eyebrow">{ll("材料", "Materials")}</h2>
                <button type="button" onClick={() => showHint(ll("上传属于本 epic（UploadDropzone），原型不真正上传", "Upload is part of this epic (UploadDropzone); the prototype doesn't really upload"))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink cursor-pointer">
                  <Upload className="w-3 h-3" /> {ll("上传", "Upload")}
                </button>
              </div>
              {sp.materials.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">{ll("还没有材料", "No materials yet")}</p>
              ) : (
                <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                  {sp.materials.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="w-4 h-4 text-muted-foreground flex-none" />
                      <span className="text-sm truncate flex-1">{m.title}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{(m.sizeBytes / 1e6).toFixed(1)} MB</span>
                      <span className="pill pill-muted cursor-help" title={ll("解析由 Reader（下一 epic）执行；文件仅存本会话，刷新后需重新上传", "Parsing lands with the Reader epic; files are session-only — re-upload after reload")}>
                        {ll("待解析", "parse pending")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* right: attach + quick actions + activity */}
          <div className="space-y-4">
            {sp.materials.length === 0 && (
              <button type="button" onClick={() => showHint(ll("上传属于本 epic（UploadDropzone）", "Upload is part of this epic"))}
                className="w-full rounded-2xl border-[1.5px] border-dashed border-[var(--accent-edge)] bg-[var(--accent-tint)] px-4 py-6 text-center cursor-pointer hover:bg-[var(--accent-tint-2)] transition-colors">
                <Upload className="w-5 h-5 mx-auto text-accent-ink" />
                <p className="text-sm font-semibold mt-2">{ll("附上第一份材料", "Attach your first material")}</p>
                <p className="text-[11px] text-muted-foreground mt-1">PDF / Markdown ≤ 20MB</p>
              </button>
            )}
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
              <h2 className="eyebrow mb-3">{ll("快速操作", "Quick actions")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { icon: ListChecks, label: ll("出题", "Quiz me"), desc: ll("从材料生成", "from materials"), off: sp.materials.length === 0, slice: ll("测验是 slice 6", "quiz = slice 6") },
                  { icon: Layers, label: ll("闪卡", "Flashcards"), desc: ll("从材料生成", "from materials"), off: sp.materials.length === 0, slice: ll("闪卡是 slice 6", "flashcards = slice 6") },
                  { icon: Upload, label: ll("上传材料", "Upload"), desc: "PDF / MD", off: false, slice: ll("上传属于本 epic", "upload = this epic") },
                  { icon: MessageCircle, label: ll("问 Companion", "Ask"), desc: ll("基于计划", "plan-grounded"), off: false, slice: ll("Companion 是 slice 4", "companion = slice 4") },
                ] as const).map(a => (
                  <button key={a.label} type="button"
                    onClick={() => showHint(a.off ? ll("先附上材料", "Attach a material first") : a.slice)}
                    title={a.off ? ll("先附上材料", "Attach a material first") : undefined}
                    className={`text-left rounded-xl border border-border-soft p-3 transition-colors ${a.off ? "opacity-50" : "hover:bg-[var(--glass-2)]"} cursor-pointer`}>
                    <a.icon className="w-4 h-4 text-accent-ink" />
                    <p className="text-[13px] font-semibold mt-1.5">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
              <h2 className="eyebrow mb-3">{ll("最近动态", "Recent activity")}</h2>
              <div className="space-y-3">
                {RECENT_ACTIVITY.map(a => (
                  <div key={a.title} className="text-xs">
                    <p className="font-semibold leading-[1.4]">{a.title}</p>
                    <p className="text-muted-foreground mt-0.5">{a.detail} · {a.when}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Plans Home ----------
  const last = plans[0];
  const showChat = homeMode === "empty" || chat.messages.length > 0;

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <PrototypeHint text={hint} />
      {/* prototype-only state toggle */}
      <div className="flex justify-end">
        <div className="flex border-[1.5px] border-dashed border-border-soft rounded-full overflow-hidden text-[10px] font-bold">
          {(["returning", "empty"] as const).map(m => (
            <button key={m} type="button" onClick={() => { setHomeMode(m); }}
              className={`px-3 py-1 cursor-pointer ${homeMode === m ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]" : "text-muted-foreground"}`}>
              {m === "returning" ? ll("返回态", "plans exist") : ll("空态", "empty")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6 mt-2">
        <div>
          <p className="eyebrow">{ll("学习计划", "Study Plans")}</p>
          <h1 className="page-title mt-1.5">{showChat ? ll("想学什么？说个主题，我来搭计划。", "What are we mastering? Name a topic, I'll draft the plan.") : ll("继续你的学习", "Continue where you left off")}</h1>
        </div>
        <StreakChip days={STREAK} />
      </div>

      {/* creation chat card (empty state primary surface) */}
      {showChat && (
        <div className="glass-panel rounded-2xl shadow-raised p-5 mt-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0 space-y-3">
              {chat.messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] text-[13px] leading-[1.55] rounded-2xl px-3.5 py-2 ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border-soft"}`}>
                  {m.text}
                </div>
              ))}
              {chat.phase === "streaming" && (
                <div className="max-w-[85%] text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl px-3.5 py-2 whitespace-pre-wrap">{streamText2(chat.streamText)}<span className="animate-pulse">▋</span></div>
              )}
              {chat.phase === "proposed" && chat.proposal && (
                <div className="bg-card border border-border-soft rounded-2xl p-4 max-w-[95%]">
                  <p className="eyebrow">{ll("结构草案 · 点节点名可重命名", "Draft structure · click a node to rename")}</p>
                  {chat.proposal.stages.map(s => (
                    <div key={s.name} className="mt-3">
                      <p className="text-xs font-bold text-accent-ink">{s.name}</p>
                      <div className="mt-1 space-y-1">
                        {s.nodeTitles.map(t => (
                          editing === t ? (
                            <input key={t} autoFocus value={draftTitle}
                              onChange={e => setDraftTitle(e.target.value)}
                              onBlur={() => { setRenames(r => ({ ...r, [t]: draftTitle })); setEditing(null); }}
                              onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                              className="w-full text-sm bg-transparent border-b border-ring outline-none" />
                          ) : (
                            <button key={t} type="button"
                              onClick={() => { setEditing(t); setDraftTitle(renames[t] ?? t); }}
                              className="block w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-[var(--glass-2)] cursor-pointer">
                              {renames[t] ?? t}
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-4">
                    <Button size="sm" onClick={confirmCreate}>{ll("确认创建计划", "Create plan")}</Button>
                    <Button size="sm" variant="ghost" onClick={chat.regenerate}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> {ll("重新生成", "Regenerate")}
                    </Button>
                  </div>
                </div>
              )}
              {chat.phase === "idle" && (
                <div className="flex flex-wrap gap-1.5">
                  {[ll("软件工程期末备考", "SE final exam prep"), ll("系统设计面试", "System design interview"), ll("机器学习入门", "ML basics")].map(s => (
                    <button key={s} type="button" onClick={() => setTopicDraft(s)}
                      className="px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Input value={topicDraft} onChange={e => setTopicDraft(e.target.value)}
              placeholder={ll("例如：COMP5241 软件工程期末备考", "e.g. COMP5241 final exam prep")}
              onKeyDown={e => e.key === "Enter" && chat.send(topicDraft, topicDraft, goalDraft || null)} />
            <Button onClick={() => chat.send(topicDraft, topicDraft, goalDraft || null)} disabled={!topicDraft.trim() || chat.phase === "streaming"}>
              {ll("生成", "Draft")}
            </Button>
          </div>
        </div>
      )}

      {/* returning: continue hero + plan cards */}
      {homeMode === "returning" && (
        <>
          {last && (
            <button type="button" onClick={() => setScreen({ kind: "plan", id: last.plan.id })}
              className="w-full text-left bg-card border border-border-soft rounded-2xl shadow-raised p-5 mt-4 flex items-center gap-5 cursor-pointer hover:border-[var(--accent-edge)] transition-colors">
              <MasteryRing value={rollupOf(last.nodes)} size={64} />
              <div className="flex-1 min-w-0">
                <p className="eyebrow">{ll("继续学习", "Continue")} · {last.lastActivity}</p>
                <p className="font-display font-bold text-lg leading-snug truncate mt-0.5">{last.plan.topic}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {last.nodes.length} {ll("节点", "nodes")} · {last.materials.length} {ll("材料", "materials")}
                </p>
              </div>
              <span className="pill pill-mastered flex-none">{ll("继续 →", "Continue →")}</span>
            </button>
          )}
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {plans.map(sp => {
              const counts = { mastered: 0, partial: 0, uncovered: 0 } as Record<string, number>;
              sp.nodes.forEach(n => (counts[n.state] += 1));
              const total = sp.nodes.length || 1;
              return (
                <button key={sp.plan.id} type="button" onClick={() => setScreen({ kind: "plan", id: sp.plan.id })}
                  className="text-left bg-card border border-border-soft rounded-2xl shadow-raised p-4 cursor-pointer hover:border-[var(--accent-edge)] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{sp.plan.topic}</p>
                    <span className="font-display font-bold tabular-nums text-sm text-accent-ink flex-none">{rollupOf(sp.nodes)}%</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-2.5" aria-hidden="true">
                    <span className="bg-[hsl(var(--mastered-tint))]" style={{ width: `${(counts.mastered / total) * 100}%` }} />
                    <span className="bg-[hsl(var(--partial-tint))]" style={{ width: `${(counts.partial / total) * 100}%` }} />
                    <span className="bg-[hsl(var(--uncovered-tint))]" style={{ width: `${(counts.uncovered / total) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {sp.nodes.length} {ll("节点", "nodes")} · {sp.materials.length} {ll("材料", "materials")} · {sp.lastActivity}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** tiny helper: cap the streamed markdown lines for the card display */
function streamText2(s: string) {
  return s.length > 900 ? s.slice(0, 900) + "…" : s;
}
