/**
 * PROTOTYPE Variant B — 「对话即门面」: the front door IS a full-height agent chat;
 * plans hang off a compact chip row. Plan Home = single centered column with a
 * vertical stepper + sticky bottom quick-action bar.
 */
import { useState } from "react";
import { ArrowLeft, FileText, Layers, ListChecks, MessageCircle, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContractNote, MasteryRing, PrototypeHint, StateGlyph, StreakChip, useHint, useLl } from "./atoms";
import { useCreationChat } from "./useCreationChat";
import { STREAK, STUB_PLANS, rollupOf, type StubPlan } from "./stub-data";
import type { StudyPlan } from "@/domain/entities";

export default function VariantB() {
  const { language } = useLanguage();
  const ll = useLl();
  const [plans, setPlans] = useState<StubPlan[]>(STUB_PLANS);
  const [screen, setScreen] = useState<{ kind: "home" } | { kind: "plan"; id: string }>({ kind: "home" });
  const [homeMode, setHomeMode] = useState<"returning" | "empty">("returning");
  const chat = useCreationChat(language);
  const { hint, showHint } = useHint();
  const [topicDraft, setTopicDraft] = useState("");
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

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

  if (screen.kind === "plan") {
    const sp = plans.find(p => p.plan.id === screen.id);
    if (!sp) return null;
    const rollup = rollupOf(sp.nodes);
    return (
      <div className="p-6 md:p-8 max-w-[720px] mx-auto pb-24">
        <PrototypeHint text={hint} />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setScreen({ kind: "home" })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> {ll("返回", "Back")}
          </button>
          <StreakChip days={STREAK} />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <MasteryRing value={rollup} size={56} />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl leading-snug truncate">{sp.plan.topic}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sp.nodes.length} {ll("节点", "nodes")} · {sp.materials.length} {ll("材料", "materials")}
            </p>
          </div>
        </div>
        <ContractNote>{ll("Rollup = 各节点均分，未覆盖按 0 计入（ADR-0001）", "Rollup = mean of node scores; uncovered counts 0 (ADR-0001)")}</ContractNote>

        {/* vertical stepper */}
        <div className="mt-6 border-l-2 border-border-soft ml-2 space-y-1">
          {sp.nodes.map(n => (
            <div key={n.id} className="relative pl-6 py-2.5">
              <span className={`absolute -left-[7px] top-4 w-3 h-3 rounded-full border-2 border-background ${n.state === "mastered" ? "bg-[hsl(var(--mastered-ink))]" : n.state === "partial" ? "bg-[hsl(var(--partial-ink))]" : "bg-[hsl(var(--muted-foreground))]/40"}`} aria-hidden="true" />
              <div className="flex items-center gap-2.5">
                <StateGlyph state={n.state} />
                <span className="text-sm font-medium truncate flex-1">{n.title}</span>
                <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">{n.evidence.length > 0 ? `${n.score}%` : ""}</span>
              </div>
              {n.evidence.length > 0 && (
                <div className="h-1 rounded-full bg-[hsl(var(--uncovered-tint))] overflow-hidden mt-1.5 max-w-[280px]">
                  <span className="block h-full rounded-full bg-gradient-to-r from-grad-a to-grad-b" style={{ width: `${n.score}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* materials slim */}
        <div className="mt-6">
          <h2 className="eyebrow mb-2">{ll("材料", "Materials")}</h2>
          {sp.materials.length === 0 ? (
            <button type="button" onClick={() => showHint(ll("上传属于本 epic（UploadDropzone）", "Upload is part of this epic"))}
              className="w-full rounded-xl border-[1.5px] border-dashed border-[var(--accent-edge)] bg-[var(--accent-tint)] px-4 py-4 text-sm font-semibold text-accent-ink cursor-pointer">
              {ll("＋ 附上第一份材料（PDF / MD ≤ 20MB）", "＋ Attach your first material (PDF / MD ≤ 20MB)")}
            </button>
          ) : (
            sp.materials.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 py-2 border-b border-border-soft">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{m.title}</span>
                <span className="pill pill-muted">{ll("待解析", "pending")}</span>
              </div>
            ))
          )}
        </div>

        {/* sticky bottom quick-actions */}
        <div className="sticky bottom-16 -mx-2 mt-8">
          <div className="flex items-center justify-center gap-2 p-2 rounded-full bg-[var(--glass-bar)] backdrop-blur border border-border-soft shadow-raised">
            {([
              { icon: ListChecks, label: ll("出题", "Quiz"), off: sp.materials.length === 0, slice: ll("测验是 slice 6", "quiz = slice 6") },
              { icon: Layers, label: ll("闪卡", "Cards"), off: sp.materials.length === 0, slice: ll("闪卡是 slice 6", "flashcards = slice 6") },
              { icon: Upload, label: ll("上传", "Upload"), off: false, slice: ll("上传属于本 epic", "upload = this epic") },
              { icon: MessageCircle, label: ll("问", "Ask"), off: false, slice: ll("Companion 是 slice 4", "companion = slice 4") },
            ] as const).map(a => (
              <button key={a.label} type="button" onClick={() => showHint(a.off ? ll("先附上材料", "Attach a material first") : a.slice)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold ${a.off ? "opacity-40" : "hover:bg-[var(--glass-3)]"} cursor-pointer`}>
                <a.icon className="w-3.5 h-3.5 text-accent-ink" /> {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Plans Home: full-height chat ----------
  const last = plans[0];
  return (
    <div className="p-4 md:p-6 max-w-[860px] mx-auto">
      <PrototypeHint text={hint} />
      {/* prototype-only state toggle */}
      <div className="flex justify-end mb-1">
        <div className="flex border-[1.5px] border-dashed border-border-soft rounded-full overflow-hidden text-[10px] font-bold">
          {(["returning", "empty"] as const).map(m => (
            <button key={m} type="button" onClick={() => setHomeMode(m)}
              className={`px-3 py-1 cursor-pointer ${homeMode === m ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]" : "text-muted-foreground"}`}>
              {m === "returning" ? ll("返回态", "plans exist") : ll("空态", "empty")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card border border-border-soft shadow-raised px-4 py-2.5">
        <span className="eyebrow">{ll("我的计划", "My plans")}</span>
        {homeMode === "returning" && plans.map(sp => (
          <button key={sp.plan.id} type="button" onClick={() => setScreen({ kind: "plan", id: sp.plan.id })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border-soft hover:bg-[var(--glass-2)] cursor-pointer">
            {sp.plan.topic}
            <span className="font-display font-bold tabular-nums text-[11px] text-accent-ink">{rollupOf(sp.nodes)}%</span>
          </button>
        ))}
        <span className="ml-auto"><StreakChip days={STREAK} /></span>
      </div>

      <div className="mt-4 h-[calc(100vh-260px)] min-h-[420px] overflow-y-auto flex flex-col gap-3 pr-1">
        {/* greeting */}
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="max-w-[80%] space-y-3">
            <div className="text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl rounded-tl-sm px-4 py-3">
              {ll("想学什么？说个主题，我来搭计划。", "What are we mastering? Name a topic, I'll draft the plan.")}
            </div>
            {homeMode === "returning" && last && (
              <button type="button" onClick={() => setScreen({ kind: "plan", id: last.plan.id })}
                className="block w-full text-left bg-card border border-border-soft rounded-2xl p-4 cursor-pointer hover:border-[var(--accent-edge)] transition-colors">
                <p className="eyebrow">{ll("继续学习", "Continue")} · {last.lastActivity}</p>
                <p className="font-display font-bold leading-snug mt-1">{last.plan.topic}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{last.nodes.length} {ll("节点", "nodes")} · {rollupOf(last.nodes)}%</p>
              </button>
            )}
          </div>
        </div>

        {chat.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-start gap-3"}`}>
            {m.role === "ai" && <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none"><Sparkles className="w-4 h-4" /></span>}
            <div className={`max-w-[80%] text-[13px] leading-[1.55] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border-soft rounded-tl-sm"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {chat.phase === "streaming" && (
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none"><Sparkles className="w-4 h-4" /></span>
            <div className="max-w-[80%] text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl rounded-tl-sm px-4 py-3 whitespace-pre-wrap">{chat.streamText}<span className="animate-pulse">▋</span></div>
          </div>
        )}
        {chat.phase === "proposed" && chat.proposal && (
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none"><Sparkles className="w-4 h-4" /></span>
            <div className="max-w-[90%] bg-card border border-border-soft rounded-2xl rounded-tl-sm p-4">
              <p className="eyebrow">{ll("结构草案 · 点节点名可重命名", "Draft structure · click a node to rename")}</p>
              {chat.proposal.stages.map(s => (
                <div key={s.name} className="mt-3">
                  <p className="text-xs font-bold text-accent-ink">{s.name}</p>
                  <div className="mt-1 space-y-0.5">
                    {s.nodeTitles.map(t => (
                      editing === t ? (
                        <input key={t} autoFocus value={draftTitle}
                          onChange={e => setDraftTitle(e.target.value)}
                          onBlur={() => { setRenames(r => ({ ...r, [t]: draftTitle })); setEditing(null); }}
                          onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-full text-sm bg-transparent border-b border-ring outline-none" />
                      ) : (
                        <button key={t} type="button" onClick={() => { setEditing(t); setDraftTitle(renames[t] ?? t); }}
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
                <Button size="sm" variant="ghost" onClick={chat.regenerate}><RotateCcw className="w-3.5 h-3.5 mr-1" />{ll("重新生成", "Regenerate")}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* sticky composer */}
      <div className="sticky bottom-14 mt-3">
        <div className="flex gap-2 items-center bg-[var(--glass-bar)] backdrop-blur border border-border-soft rounded-full shadow-raised px-2 py-1.5">
          <Input className="border-0 bg-transparent focus-visible:ring-0 h-8"
            value={topicDraft} onChange={e => setTopicDraft(e.target.value)}
            placeholder={ll("输入主题，例如：COMP5241 期末备考…", "Type a topic, e.g. COMP5241 final prep…")}
            onKeyDown={e => e.key === "Enter" && chat.send(topicDraft, topicDraft, null)} />
          <Button size="sm" className="rounded-full h-8 px-4" disabled={!topicDraft.trim() || chat.phase === "streaming"}
            onClick={() => chat.send(topicDraft, topicDraft, null)}>
            {ll("生成", "Draft")}
          </Button>
        </div>
      </div>
    </div>
  );
}
