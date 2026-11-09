/**
 * The creation chat surface (FR-1; Q4; spec AD-5): required topic + optional
 * free-text goal streams the Companion's plan-structure proposal live, resolves
 * into a stage-grouped structure card, and confirms into a real persisted plan
 * via the pure mapping seam + the create mutation. Shared by the Plans-Home
 * empty state and the /plan/new route; confirming always lands on that plan's
 * Plan Home.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatMarkdown from "@/components/shared/chat-markdown";
import { CopyButton } from "@/components/shared/copy-button";
import { useCreatePlanMutation, newClientUuid } from "@/api";
import { cn } from "@/lib/utils";
import { proposalNodeKey, toPlanCreateInput } from "./creation-mapping";
import { useCreationChat } from "./use-creation-chat";

const STREAM_DISPLAY_CAP = 900;

/**
 * The four named goals (T5 · A3/FR-1 note): the selection feeds the proposal
 * stream's goal param and, through the same lastInput.goal as free text, the
 * createPlan input. The canonical value crosses the wire (stable across the
 * UI language); the free-text goal input stays the optional override.
 */
const GOALS = [
  { value: "exam-prep", labelKey: "plans.goalExam" },
  { value: "deep-understanding", labelKey: "plans.goalDeep" },
  { value: "revision", labelKey: "plans.goalRevision" },
  { value: "daily-practice", labelKey: "plans.goalDaily" },
] as const;

export default function CreationChat() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const chat = useCreationChat(language);
  const [createPlan, { loading: planCreating }] = useCreatePlanMutation();

  const [topicDraft, setTopicDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  // The named goal selection (null = none); a typed goal overrides it.
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  // Epic P2-11 T1 (FR-38): the plan's starting visibility, chosen at the
  // confirm step (default private — the Square opt-in needs the same
  // structure-only disclosure as the plan-home flip).
  const [createVisibility, setCreateVisibility] = useState<"private" | "public">("private");
  // Renames are keyed by the node's proposal-wide order index (proposalNodeKey),
  // never by title — duplicate titles in one draft must rename independently.
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  /** A named goal renders in the UI language; a free-text goal renders as typed. */
  const goalDisplay = (goal: string | null | undefined) => {
    if (!goal) return null;
    const named = GOALS.find((g) => g.value === goal);
    return named ? t(named.labelKey) : goal;
  };

  const submit = () => {
    const topic = topicDraft.trim();
    if (!topic || chat.phase === "streaming") return;
    // free text wins over the chip — the input stays the honest override
    chat.send(topic, goalDraft.trim() || selectedGoal);
    setTopicDraft("");
    setGoalDraft("");
    setSelectedGoal(null);
    setRenames({});
  };

  const commitRename = (key: string, original: string) => {
    const next = renameDraft.trim();
    setRenames((r) => {
      const updated = { ...r };
      if (next && next !== original) updated[key] = next;
      else delete updated[key];
      return updated;
    });
    setEditingKey(null);
    setRenameDraft("");
  };

  const regenerate = () => {
    setRenames({});
    setEditingKey(null);
    chat.regenerate();
  };

  const confirm = () => {
    if (!chat.proposal || planCreating) return;
    const input = toPlanCreateInput(chat.proposal, renames, chat.lastInput.goal);
    createPlan({
      variables: {
        input: {
          // AD-12: the client-supplied uuid is the create's idempotency key.
          clientUuid: newClientUuid(),
          topic: input.topic,
          goal: input.goal,
          // FR-38 (epic P2-11 T1): the create-step visibility choice — the
          // api defaults private; the choice is always sent explicitly.
          visibility: createVisibility,
          // epic-16 (FR-5): nodes carry their client-minted ids + metadata;
          // the proposal's title pairs ride as id pairs (unresolvable pairs
          // already dropped at the flatten seam — invalid ones the server
          // drops silently; neither ever blocks the create).
          nodes: input.nodes,
          edges: input.edges,
        },
      },
      onCompleted: (data) => {
        chat.reset();
        setRenames({});
        setCreateVisibility("private");
        navigate(`/plan/${data.createPlan.plan.id}`);
      },
      onError: () => toast.error(t("plans.createError")),
    });
  };

  const suggestions = ["plans.suggestExam", "plans.suggestInterview", "plans.suggestMl"] as const;

  // Proposal nodes in the same enumeration order toPlanCreateInput uses, so the
  // rename keys here match the keys the mapper reads (stage-then-node order).
  let runningIndex = 0;
  const stageEntries = (chat.proposal?.stages ?? []).map((s) => ({
    name: s.name,
    entries: s.nodes.map((node) => ({ title: node.title, key: proposalNodeKey(runningIndex++) })),
  }));

  return (
    <div className="glass-panel rounded-2xl shadow-raised p-5 mt-4">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 space-y-3">
          {chat.messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "group relative max-w-[85%] text-[13px] leading-[1.55] rounded-2xl px-3.5 py-2",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border-soft",
              )}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.text}</span>
              ) : (
                <ChatMarkdown text={m.text} />
              )}
              {m.goal && <span className="block text-[11px] opacity-80 mt-1">{t("plans.goalLabel")}{goalDisplay(m.goal)}</span>}
              <CopyButton
                text={m.text}
                testId={`chat-copy-creation-${m.role}`}
                className={cn(
                  "absolute -top-3 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
                  m.role === "user" ? "left-0" : "right-0",
                )}
              />
            </div>
          ))}

          {chat.phase === "streaming" && (
            <div className="max-w-[85%] text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl px-3.5 py-2">
              <ChatMarkdown
                text={
                  chat.streamText.length > STREAM_DISPLAY_CAP
                    ? `${chat.streamText.slice(0, STREAM_DISPLAY_CAP)}…`
                    : chat.streamText
                }
              />
              <span className="animate-pulse">▋</span>
            </div>
          )}

          {chat.phase === "proposed" && chat.proposal && (
            <div className="bg-card border border-border-soft rounded-2xl p-4 max-w-[95%]">
              <p className="eyebrow">{t("plans.draftLabel")}</p>
              {stageEntries.map((stage) => (
                <div key={stage.name} className="mt-3">
                  <p className="text-xs font-bold text-accent-ink">{stage.name}</p>
                  <div className="mt-1 space-y-1">
                    {stage.entries.map((entry) =>
                      editingKey === entry.key ? (
                        <input
                          key={entry.key}
                          autoFocus
                          value={renameDraft}
                          aria-label={t("plans.renameAria")}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(entry.key, entry.title)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-full text-sm bg-transparent border-b border-ring outline-none"
                        />
                      ) : (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => {
                            setEditingKey(entry.key);
                            setRenameDraft(renames[entry.key] ?? entry.title);
                          }}
                          className="block w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-[var(--glass-2)] cursor-pointer"
                        >
                          {renames[entry.key] ?? entry.title}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))}
              {/* Epic P2-11 T1 (FR-38): the create-step visibility choice —
                  the disclosure rides along, whichever way the user picks. */}
              <div className="mt-4 border-t border-border-soft pt-3">
                <p className="text-[11px] text-muted-foreground">{t("visibility.createLabel")}</p>
                <div className="flex items-center gap-1.5 mt-1.5" role="radiogroup" aria-label={t("visibility.createLabel")}>
                  {(["private", "public"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={createVisibility === value}
                      data-testid={`create-visibility-${value}`}
                      onClick={() => setCreateVisibility(value)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer",
                        createVisibility === value
                          ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] text-accent-ink"
                          : "border-border-soft text-muted-foreground hover:bg-[var(--glass-2)]",
                      )}
                    >
                      {t(value === "private" ? "visibility.chipPrivate" : "visibility.chipPublic")}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-[1.5]">{t("visibility.disclosure")}</p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={confirm} disabled={planCreating}>
                  {planCreating ? t("plans.creating") : t("plans.confirmCreate")}
                </Button>
                <Button size="sm" variant="ghost" onClick={regenerate} disabled={planCreating}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t("plans.regenerate")}
                </Button>
              </div>
            </div>
          )}

          {chat.phase === "idle" && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTopicDraft(t(key))}
                  className="px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex gap-2">
          <Input
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
            placeholder={t("plans.topicPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={!topicDraft.trim() || chat.phase === "streaming"}>
            {t("plans.send")}
          </Button>
        </div>
        {chat.phase === "idle" && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("plans.goalPickerLabel")}>
            {GOALS.map((goal) => (
              <button
                key={goal.value}
                type="button"
                role="radio"
                aria-checked={selectedGoal === goal.value}
                data-testid={`creation-goal-${goal.value}`}
                onClick={() => setSelectedGoal((current) => (current === goal.value ? null : goal.value))}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer",
                  selectedGoal === goal.value
                    ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] text-accent-ink"
                    : "border-border-soft text-muted-foreground hover:bg-[var(--glass-2)]",
                )}
              >
                {t(goal.labelKey)}
              </button>
            ))}
          </div>
        )}
        <Input
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          placeholder={t("plans.goalPlaceholder")}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
    </div>
  );
}
