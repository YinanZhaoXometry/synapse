/**
 * QuizLauncher (epic-6 T2 + T4; UX spine QuizLauncher contract; FR-18): mode
 * select (Open / Choice / Mix) + scope select (whole plan / one material —
 * node scope is Phase 2). Renders as the dialog CONTENT on Plan (later Task)
 * Home's 出题 quick tile and inline on /plan/:id/quiz and /task/:id/quiz — one
 * component, every surface. Generation goes through the session driver's AI
 * seam; the generating state shows 「来自 N 份材料 · 正在出题」 and stays
 * cancellable until the first question (cancel = no session); failure is a
 * neutral toast with the form intact for retry. No quizable materials →
 * disabled with a bilingual reason (spec story 7).
 *
 * Ownership (AD-6, T4): the launcher is plan-scoped by default; a task
 * surface passes `taskId` — the session is created with `planId: null,
 * taskId` set (mastery never bleeds between plans and tasks), and the scope
 * picker is dropped: a task is trivially scoped to its single material (its
 * only possible scope), so only the mode select remains.
 */
import { useEffect, useRef, useState } from "react";
import { CircleAlert, FileText, Layers, ListChecks, Loader2, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { QuizMode } from "@/ai/types";
import type { Material } from "@/domain/entities";
import { quizableMaterials, quizMaterialRefs } from "./display-shaping";
import { useQuizSession, type QuizStartInput } from "./use-quiz-session";

export interface QuizLauncherProps {
  /** The owning plan's id — omit/set null on a task surface (AD-6 ownership). */
  planId?: string | null;
  /** The owning task's id — set on a task surface; the scope picker is dropped. */
  taskId?: string | null;
  /** The owner's node ids — generation attribution round-robins over them (AD-6). */
  nodeIds: string[];
  /** The owner's attached materials (already loaded); quizable ones shape the scopes. */
  materials: Material[];
  /**
   * Called once a session EXISTS (persisted, first question ready). The exact
   * QuizStartInput rides along so the surface can offer 再来一轮 with the same
   * params (fresh session id — spec decision 8).
   */
  onStarted: (sessionId: string, input: QuizStartInput) => void;
}

const MODES = [
  { value: "open", labelKey: "quiz.launcher.modeOpen", descKey: "quiz.launcher.modeOpenDesc", icon: PenLine },
  { value: "choice", labelKey: "quiz.launcher.modeChoice", descKey: "quiz.launcher.modeChoiceDesc", icon: ListChecks },
  { value: "mix", labelKey: "quiz.launcher.modeMix", descKey: "quiz.launcher.modeMixDesc", icon: Layers },
] as const;

export function QuizLauncher({ planId, taskId, nodeIds, materials, onStarted }: QuizLauncherProps) {
  const { t } = useLanguage();
  const driver = useQuizSession();
  const [mode, setMode] = useState<QuizMode>("mix");
  const [scope, setScope] = useState<string>("plan"); // "plan" | material id (plan surfaces only)
  // The exact start input of the in-flight/succeeded launch — rides to
  // onStarted so the surface can retake with identical params.
  const inputRef = useRef<QuizStartInput | null>(null);

  const quizable = quizableMaterials(materials);
  // A task surface has exactly one scope — its single material — so the scope
  // select is not rendered and generation always covers every quizable material.
  const scopedMaterials = taskId ? quizable : scope === "plan" ? quizable : quizable.filter((m) => m.id === scope);

  // Generation landed: hand the session id + params to the surface (page → ?session=…).
  useEffect(() => {
    if (driver.phase === "active" && driver.run?.sessionId && inputRef.current) {
      onStarted(driver.run.sessionId, inputRef.current);
    }
  }, [driver.phase, driver.run?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A material-scope default that survives a re-render with loaded materials.
  useEffect(() => {
    if (scope !== "plan" && !quizable.some((m) => m.id === scope)) setScope("plan");
  }, [materials]); // eslint-disable-line react-hooks/exhaustive-deps

  if (quizable.length === 0) {
    // The disabled state explains itself (UX spine; spec story 7).
    return (
      <div className="text-center py-6 px-4" data-testid="quiz-launcher-disabled">
        <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("quiz.launcher.title")}</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-[1.6]">{t("quiz.launcher.needMaterial")}</p>
      </div>
    );
  }

  if (driver.phase === "generating") {
    // 「来自 N 份材料 · 正在出题」 — cancellable until the first question renders.
    return (
      <div className="text-center py-8 px-4" data-testid="quiz-launcher-generating">
        <Loader2 className="w-5 h-5 mx-auto animate-spin text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-semibold mt-3">{t("quiz.launcher.generating", { n: scopedMaterials.length })}</p>
        <button
          type="button"
          data-testid="quiz-launcher-cancel"
          onClick={() => driver.cancelStart()}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-[var(--glass-4)] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
        >
          {t("quiz.launcher.cancel")}
        </button>
      </div>
    );
  }

  const start = async () => {
    const input: QuizStartInput = {
      materials: quizMaterialRefs(scopedMaterials),
      nodeIds,
      mode,
      // AD-6 ownership: exactly one of the two — a task session never
      // attributes to a plan node, and vice versa.
      planId: taskId ? null : (planId ?? null),
      taskId: taskId ?? null,
    };
    inputRef.current = input;
    try {
      await driver.start(input);
    } catch {
      // neutral toast, form stays for the retry; plan state untouched, no session (spec story 8)
      inputRef.current = null;
      toast(t("quiz.launcher.failed"));
    }
  };

  return (
    <div data-testid="quiz-launcher">
      <p className="eyebrow">{t("quiz.launcher.title")}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-[1.6]">{t("quiz.launcher.subtitle")}</p>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
          {t("quiz.launcher.modeLabel")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={t("quiz.launcher.modeLabel")}>
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              data-testid={`quiz-mode-${m.value}`}
              onClick={() => setMode(m.value)}
              className={cn(
                "text-left rounded-xl border p-3 transition-colors cursor-pointer",
                mode === m.value
                  ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] shadow-[0_0_0_3px_var(--accent-ring)]"
                  : "border-border-soft hover:bg-[var(--glass-2)]",
              )}
            >
              <m.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
              <p className="text-[13px] font-semibold mt-1.5">{t(m.labelKey)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-[1.5]">{t(m.descKey)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Task surfaces skip the scope select: the single material IS the scope
          (T4) — 「整个计划」 would be a lie on a task surface. */}
      {!taskId && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
            {t("quiz.launcher.scopeLabel")}
          </p>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("quiz.launcher.scopeLabel")}>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "plan"}
              data-testid="quiz-scope-plan"
              onClick={() => setScope("plan")}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors cursor-pointer",
                scope === "plan"
                  ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] shadow-[0_0_0_3px_var(--accent-ring)]"
                  : "border-border-soft hover:bg-[var(--glass-2)]",
              )}
            >
              <Layers className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
              {t("quiz.launcher.scopePlan")}
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">{quizable.length}</span>
            </button>
            {quizable.map((material) => (
              <button
                key={material.id}
                type="button"
                role="radio"
                aria-checked={scope === material.id}
                data-testid={`quiz-scope-${material.id}`}
                onClick={() => setScope(material.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors cursor-pointer min-w-0",
                  scope === material.id
                    ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] shadow-[0_0_0_3px_var(--accent-ring)]"
                    : "border-border-soft hover:bg-[var(--glass-2)]",
                )}
              >
                <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
                <span className="truncate font-semibold">{material.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-none">
                  {t("plans.parseParsed", { n: material.sections.length })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        data-testid="quiz-launcher-start"
        onClick={() => void start()}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {t("quiz.launcher.start")}
      </button>
    </div>
  );
}
