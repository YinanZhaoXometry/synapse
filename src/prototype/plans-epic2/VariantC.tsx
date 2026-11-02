/**
 * PROTOTYPE Variant C — 「编辑部时间线」: editorial, type-led front door — a pinned
 * command-bar input ("one line in, plan out") over a recency timeline of plans;
 * Plan Home = a stage-by-stage vertical roadmap (milestone rail), big rollup number
 * instead of a ring.
 */
import { useState } from "react";
import { ArrowLeft, FileText, Layers, ListChecks, MessageCircle, RotateCcw, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { PrototypeHint, StateGlyph, StreakChip, useHint, useLl } from "./atoms";
import { useCreationChat } from "./useCreationChat";
import { STREAK, STUB_PLANS, rollupOf, type StubPlan } from "./stub-data";
import type { StudyPlan } from "@/domain/entities";

export default function VariantC() {
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
    const stages = [...new Set(sp.nodes.map(n => n.stage ?? "—"))];
    const rollup = rollupOf(sp.nodes);
    return (
      <div className="p-6 md:p-8 max-w-[760px] mx-auto">
        <PrototypeHint text={hint} />
        <button type="button" onClick={() => setScreen({ kind: "home" })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> {ll("所有路径", "All paths")}
        </button>

        <div className="flex items-end justify-between gap-4 mt-3 pb-5 border-b border-border-soft">
          <div className="min-w-0">
            <p className="eyebrow">{ll("学习路径", "Learning path")}</p>
            <h1 className="font-display font-bold text-2xl leading-tight mt-1.5">{sp.plan.topic}</h1>
            {sp.plan.goal && <p className="text-xs text-muted-foreground mt-1.5">{ll("目标", "Goal")} — {sp.plan.goal}</p>}
          </div>
          <div className="text-right flex-none">
            <p className="font-display font-bold tabular-nums text-4xl leading-none text-[hsl(var(--foreground))]">{rollup}<span className="text-lg text-muted-foreground">%</span></p>
            <p className="text-[10px] text-muted-foreground mt-1">{ll("Mastery Rollup · 未覆盖按 0 计", "Mastery rollup · uncovered counts 0")}</p>
            <div className="mt-2"><StreakChip days={STREAK} /></div>
          </div>
        </div>

        {/* quick actions: compact horizontal strip */}
        <div className="flex items-center gap-1 py-2.5 border-b border-border-soft -mx-1 px-1 overflow-x-auto">
          {([
            { icon: ListChecks, label: ll("出题", "Quiz"), off: sp.materials.length === 0, slice: ll("测验是 slice 6", "quiz = slice 6") },
            { icon: Layers, label: ll("闪卡", "Cards"), off: sp.materials.length === 0, slice: ll("闪卡是 slice 6", "flashcards = slice 6") },
            { icon: Upload, label: ll("上传", "Upload"), off: false, slice: ll("上传属于本 epic", "upload = this epic") },
            { icon: MessageCircle, label: ll("问 Companion", "Ask"), off: false, slice: ll("Companion 是 slice 4", "companion = slice 4") },
          ] as const).map(a => (
            <button key={a.label} type="button" onClick={() => showHint(a.off ? ll("先附上材料", "Attach a material first") : a.slice)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${a.off ? "opacity-40" : "hover:bg-[var(--glass-2)]"} cursor-pointer`}>
              <a.icon className="w-3.5 h-3.5 text-accent-ink" /> {a.label}
            </button>
          ))}
        </div>

        {/* roadmap milestones */}
        {stages.map(stage => (
          <section key={stage} className="mt-6">
            <div className="flex items-center gap-3">
              <h2 className="eyebrow flex-none">{stage}</h2>
              <span className="h-px flex-1 bg-border-soft" aria-hidden="true" />
            </div>
            <div className="mt-2 ml-2 border-l-2 border-border-soft">
              {sp.nodes.filter(n => (n.stage ?? "—") === stage).map(n => (
                <div key={n.id} className="relative pl-6 py-2.5">
                  <span className={`absolute -left-[7px] top-4 w-3 h-3 rounded-full border-2 border-background ${n.state === "mastered" ? "bg-[hsl(var(--mastered-ink))]" : n.state === "partial" ? "bg-[hsl(var(--partial-ink))]" : "bg-[hsl(var(--muted-foreground))]/40"}`} aria-hidden="true" />
                  <div className="flex items-center gap-2.5">
                    <StateGlyph state={n.state} />
                    <span className="text-sm truncate flex-1">{n.title}</span>
                    <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">{n.evidence.length > 0 ? `${n.score}%` : "·"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* materials as slim text rows */}
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <h2 className="eyebrow flex-none">{ll("材料", "Materials")}</h2>
            <span className="h-px flex-1 bg-border-soft" aria-hidden="true" />
            <button type="button" onClick={() => showHint(ll("上传属于本 epic（UploadDropzone）", "Upload is part of this epic"))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink cursor-pointer">
              <Upload className="w-3 h-3" /> {ll("上传", "Upload")}
            </button>
          </div>
          {sp.materials.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">{ll("还没有材料 — 路径是骨架，材料是血肉。", "No materials yet — the plan is the skeleton; materials are the flesh.")}</p>
          ) : (
            sp.materials.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 py-2.5 border-b border-border-soft">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{m.title}</span>
                <span className="pill pill-muted cursor-help" title={ll("解析由 Reader（下一 epic）执行", "Parsing lands with the Reader epic")}>{ll("待解析", "pending")}</span>
              </div>
            ))
          )}
        </section>
      </div>
    );
  }

  // ---------- Plans Home: editorial timeline ----------
  const showCreation = homeMode === "empty" || chat.messages.length > 0 || chat.phase !== "idle";
  return (
    <div className="p-6 md:p-10 max-w-[820px] mx-auto">
      <PrototypeHint text={hint} />
      {/* prototype-only state toggle */}
      <div className="flex justify-end mb-2">
        <div className="flex border-[1.5px] border-dashed border-border-soft rounded-full overflow-hidden text-[10px] font-bold">
          {(["returning", "empty"] as const).map(m => (
            <button key={m} type="button" onClick={() => setHomeMode(m)}
              className={`px-3 py-1 cursor-pointer ${homeMode === m ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]" : "text-muted-foreground"}`}>
              {m === "returning" ? ll("返回态", "plans exist") : ll("空态", "empty")}
            </button>
          ))}
        </div>
      </div>

      <p className="eyebrow">{ll("Synapse · 学习计划", "Synapse · Study Plans")}</p>
      <h1 className="font-display font-bold text-[28px] md:text-[34px] leading-[1.15] mt-2 max-w-[22ch]">
        {showCreation ? ll("现在，从一条路径开始。", "Start with one path, right now.") : ll("继续走你的路径。", "Keep walking your paths.")}
      </h1>
      <div className="flex items-center gap-3 mt-4">
        <StreakChip days={STREAK} />
        <span className="text-[11px] text-muted-foreground">{ll("连续证据天数", "consecutive evidence days")}</span>
      </div>

      {/* command bar */}
      <form className="mt-6" onSubmit={e => { e.preventDefault(); chat.send(topicDraft, topicDraft, null); setTopicDraft(""); }}>
        <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-border-soft bg-card shadow-raised px-4 py-3 focus-within:border-[var(--accent-edge)] focus-within:ring-4 focus-within:ring-[var(--accent-ring)] transition-all">
          <span className="font-display text-accent-ink font-bold">→</span>
          <input
            value={topicDraft}
            onChange={e => setTopicDraft(e.target.value)}
            placeholder={ll("输入主题，回车生成计划…", "Type a topic, press Enter to draft a plan…")}
            className="flex-1 bg-transparent outline-none text-sm font-display placeholder:text-muted-foreground"
          />
        </div>
      </form>

      {/* streaming / proposal, editorial style */}
      {chat.phase === "streaming" && (
        <p className="font-display italic text-sm leading-[1.7] text-muted-foreground mt-5 whitespace-pre-wrap max-w-[60ch]">{chat.streamText}<span className="animate-pulse">▋</span></p>
      )}
      {chat.phase === "proposed" && chat.proposal && (
        <div className="mt-6 rounded-2xl bg-card border border-border-soft shadow-raised p-5">
          <p className="eyebrow">{ll("结构草案 · 点节点名可重命名", "Draft structure · click a node to rename")}</p>
          {chat.proposal.stages.map(s => (
            <div key={s.name} className="mt-3">
              <p className="text-xs font-bold text-accent-ink tracking-wide">{s.name}</p>
              <div className="mt-1">
                {s.nodeTitles.map(t => (
                  editing === t ? (
                    <input key={t} autoFocus value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      onBlur={() => { setRenames(r => ({ ...r, [t]: draftTitle })); setEditing(null); }}
                      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-full text-sm bg-transparent border-b border-ring outline-none py-0.5" />
                  ) : (
                    <button key={t} type="button" onClick={() => { setEditing(t); setDraftTitle(renames[t] ?? t); }}
                      className="block w-full text-left text-sm py-1 border-b border-border-soft/60 cursor-pointer hover:text-accent-ink">
                      {renames[t] ?? t}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-4">
            <Button size="sm" onClick={confirmCreate}>{ll("就按这个来", "Commit this")}</Button>
            <Button size="sm" variant="ghost" onClick={chat.regenerate}><RotateCcw className="w-3.5 h-3.5 mr-1" />{ll("换个搭法", "Redraft")}</Button>
          </div>
        </div>
      )}

      {/* timeline of plans */}
      {homeMode === "returning" && (
        <div className="mt-10 ml-2 border-l-2 border-border-soft">
          {plans.map(sp => (
            <div key={sp.plan.id} className="relative pl-7 pb-8">
              <span className="absolute -left-[6px] top-2 w-3 h-3 rounded-full border-2 border-background bg-[var(--accent-edge)]" aria-hidden="true" />
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">{sp.lastActivity}</p>
              <button type="button" onClick={() => setScreen({ kind: "plan", id: sp.plan.id })}
                className="mt-1 flex items-baseline gap-3 text-left cursor-pointer group w-full">
                <span className="font-display font-bold text-xl leading-snug group-hover:text-accent-ink transition-colors">{sp.plan.topic}</span>
                <span className="font-display font-bold tabular-nums text-lg text-accent-ink flex-none">{rollupOf(sp.nodes)}%</span>
              </button>
              <p className="text-xs text-muted-foreground mt-1">
                {sp.nodes.length} {ll("节点", "nodes")} · {sp.materials.length} {ll("材料", "materials")}{sp.plan.goal ? ` · ${ll("目标", "goal")} ${sp.plan.goal}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {homeMode === "returning" && (
        <p className="text-[11px] text-muted-foreground mt-2 -ml-0.5">
          {ll("在上方输入新主题，即可另起一条路径。", "Type a new topic above to start another path.")}
        </p>
      )}
    </div>
  );
}
