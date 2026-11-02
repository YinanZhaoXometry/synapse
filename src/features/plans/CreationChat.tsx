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
import { useCreatePlanMutation } from "@/data";
import { toPlanCreateInput } from "./creation-mapping";
import { useCreationChat } from "./use-creation-chat";

const STREAM_DISPLAY_CAP = 900;

export default function CreationChat() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const chat = useCreationChat(language);
  const createPlan = useCreatePlanMutation();

  const [topicDraft, setTopicDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const submit = () => {
    const topic = topicDraft.trim();
    if (!topic || chat.phase === "streaming") return;
    chat.send(topic, goalDraft.trim() || null);
    setTopicDraft("");
    setGoalDraft("");
    setRenames({});
  };

  const commitRename = (original: string) => {
    const next = renameDraft.trim();
    setRenames((r) => {
      const updated = { ...r };
      if (next && next !== original) updated[original] = next;
      else delete updated[original];
      return updated;
    });
    setEditingTitle(null);
    setRenameDraft("");
  };

  const regenerate = () => {
    setRenames({});
    setEditingTitle(null);
    chat.regenerate();
  };

  const confirm = () => {
    if (!chat.proposal || createPlan.isPending) return;
    const input = toPlanCreateInput(chat.proposal, renames, chat.lastInput.goal);
    createPlan.mutate(input, {
      onSuccess: ({ plan }) => {
        chat.reset();
        setRenames({});
        navigate(`/plan/${plan.id}`);
      },
      onError: () => toast.error(t("plans.createError")),
    });
  };

  const suggestions = ["plans.suggestExam", "plans.suggestInterview", "plans.suggestMl"] as const;

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
              className={`max-w-[85%] text-[13px] leading-[1.55] rounded-2xl px-3.5 py-2 ${
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border-soft"
              }`}
            >
              <span className="whitespace-pre-wrap">{m.text}</span>
              {m.goal && <span className="block text-[11px] opacity-80 mt-1">{t("plans.goalLabel")}{m.goal}</span>}
            </div>
          ))}

          {chat.phase === "streaming" && (
            <div className="max-w-[85%] text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl px-3.5 py-2 whitespace-pre-wrap">
              {chat.streamText.length > STREAM_DISPLAY_CAP
                ? `${chat.streamText.slice(0, STREAM_DISPLAY_CAP)}…`
                : chat.streamText}
              <span className="animate-pulse">▋</span>
            </div>
          )}

          {chat.phase === "proposed" && chat.proposal && (
            <div className="bg-card border border-border-soft rounded-2xl p-4 max-w-[95%]">
              <p className="eyebrow">{t("plans.draftLabel")}</p>
              {chat.proposal.stages.map((s) => (
                <div key={s.name} className="mt-3">
                  <p className="text-xs font-bold text-accent-ink">{s.name}</p>
                  <div className="mt-1 space-y-1">
                    {s.nodeTitles.map((title) =>
                      editingTitle === title ? (
                        <input
                          key={title}
                          autoFocus
                          value={renameDraft}
                          aria-label={t("plans.renameAria")}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(title)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-full text-sm bg-transparent border-b border-ring outline-none"
                        />
                      ) : (
                        <button
                          key={title}
                          type="button"
                          onClick={() => {
                            setEditingTitle(title);
                            setRenameDraft(renames[title] ?? title);
                          }}
                          className="block w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-[var(--glass-2)] cursor-pointer"
                        >
                          {renames[title] ?? title}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" onClick={confirm} disabled={createPlan.isPending}>
                  {createPlan.isPending ? t("plans.creating") : t("plans.confirmCreate")}
                </Button>
                <Button size="sm" variant="ghost" onClick={regenerate} disabled={createPlan.isPending}>
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
