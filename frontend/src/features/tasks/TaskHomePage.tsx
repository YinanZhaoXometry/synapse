/**
 * Task Home — /task/:id (T2 + T4; FR-37; AD-6/8): the single-material twin of
 * Plan Home, the task's stable home address beyond the reader. Breadcrumb back
 * to Plans Home (the task is never a trap); the material row opens the
 * Immersive Reader and offers re-upload when the session-only bytes are gone
 * after a reload — through the reader's own re-upload contract (kind-matched
 * validateReupload + sessionBlobs.put, pending/failed re-parse; AD-7), plus a
 * fresh presigned PUT so the server copy recovers too (FR-29); the
 * Mastery Ring shows the task rollup — exactly its single owned node's SERVER
 * score (AD-14) through pure display-shaping selectors, never a
 * share-of-mastered collapse (ADR-0001) — with the shared state vocabulary
 * (uncovered/partial/mastered, glyph + label) and an evidence popover that
 * names what moved the number, including the cap-99-below-gate behavior. The
 * quiz and flashcard quick tiles are REAL launches (T4, the epic-5
 * placeholders gone): the quiz tile opens the QuizLauncher dialog (mode
 * select — the task's single material IS the scope; session created with
 * planId null, taskId set, AD-6), the flashcard tile opens the study directly
 * when the task's deck exists (「继续学习」) or the FlashcardLauncher dialog
 * when it doesn't (T3's no-silent-duplication policy). Companion is reached
 * via the reader — no duplicate surface here. No upload zone: a task is
 * strictly 1:1 with its material.
 */
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, FileText, Layers, ListChecks, RotateCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  newClientUuid,
  sessionBlobs,
  useAllEvidenceQuery,
  useFlashcardsByMaterialQuery,
  useMaterialUpload,
  usePromoteTaskToPlanMutation,
  useReadingProgressQuery,
  useTaskMaterialsQuery,
  useTaskQuery,
} from "@/api";
import { cn } from "@/lib/utils";
import type { KnowledgeNodeView } from "@/api/views";
import type { Material } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { ContractNote, isPptxUpload, MasteryRing, NodeStateBadge, OutcomeMark, OUTCOME_LABEL_KEY, useSessionBlob } from "@/features/plans";
import { QuizLauncher, quizableMaterials } from "@/features/quiz";
import { FlashcardLauncher } from "@/features/flashcards";
import { PARSE_REASON_MESSAGE_KEY, useParseMaterialMutation, validateReupload } from "@/features/reader";
import { taskMasteryView, type TaskMasteryView } from "./display-shaping";

export default function TaskHomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const taskQuery = useTaskQuery(id ?? "");
  const materialsQuery = useTaskMaterialsQuery(id ?? "");
  const evidenceQuery = useAllEvidenceQuery();
  // T4: the flashcards entry reads the task's persisted deck — cards exist →
  // the tile opens the study directly; none → the launcher dialog generates.
  const cardsQuery = useFlashcardsByMaterialQuery(taskQuery.data?.materialId ?? "");
  const upload = useMaterialUpload();
  // The eager-parse seam binds to the task's single material row (it resolves
  // bytes session-first, then the row's presigned GET — never a fake parse).
  const parseMaterial = useParseMaterialMutation(materialsQuery.data?.[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // T4: the launcher dialogs (Plan Home's quick-action pattern).
  const [quizOpen, setQuizOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  // FR-37 stretch (epic-14 T2): the promote confirm dialog — the mutation
  // navigates to the new plan on success; the plans-list read-back sweep
  // (the hook's refetch) brings it into 我要学.
  const promote = usePromoteTaskToPlanMutation();
  const [promoteOpen, setPromoteOpen] = useState(false);

  if (taskQuery.loading || materialsQuery.loading || evidenceQuery.loading || cardsQuery.loading) return null;
  const task = taskQuery.data;
  // The single auto-owned node rides on the task view (AD-6) — server-scored.
  const node: KnowledgeNodeView | undefined = task?.node;
  const materials = materialsQuery.data ?? [];
  const material = materials[0]; // strictly 1:1 (StudyTask ||--|| Material) — no upload zone
  const evidence = evidenceQuery.data ?? [];
  const taskCards = cardsQuery.data ?? [];
  const hasCards = taskCards.length > 0;
  // The promoted pointer (epic-14 T2): server truth (promotedPlanId non-null
  // ⇔ promoted — never derived). A promoted task is read-only: its content
  // moved into the plan, so no writable action stays here — the page renders
  // the pointer card honestly.
  const promoted = !!task?.promotedPlanId;

  const backLink = (
    <button
      type="button"
      onClick={() => navigate("/plans")}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {t("tasks.backToPlans")}
    </button>
  );

  if (!task) {
    // Honest not-found (AD-8): an unknown id never pretends — same pattern as Plan Home.
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        {backLink}
        <p className="page-title mt-6 text-lg">{t("tasks.notFound")}</p>
      </div>
    );
  }

  const view = taskMasteryView(node, evidence); // the ONLY path numbers take (AD-6)
  const title = material?.title ?? node?.title ?? "";

  // Re-upload (FR-29 contract): fresh session bytes for the SAME material —
  // metadata and already-extracted sections stay the row's truth; a
  // pending/failed material re-runs the parse right away (the reader's own
  // re-upload card semantics, through its public contract), and the bytes
  // re-PUT through a fresh presign so the server copy recovers too.
  const handleReupload = (file: File | undefined) => {
    if (!file || !material) return;
    const verdict = validateReupload(file, material.kind);
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    // epic-13 T5: the deck's re-upload re-parses client-side — the limitation
    // note rides along, same as at attach time.
    if (isPptxUpload(file)) toast.info(t("reader.pptxTextOnlyNote"));
    sessionBlobs.put(material.id, file);
    if (material.parseState === "pending" || material.parseState === "failed") {
      parseMaterial.mutate(material.id);
    }
    upload
      .refreshBytes(material.id, file)
      .catch((err) => {
        console.error("[upload] re-upload failed:", err);
        toast.error(t("errors.uploadFailed"));
      });
  };

  // T4 quick actions — the Plan Home policy mirrored on the single material:
  // quiz generation needs parsed sections (FR-18 sourcing honesty); the
  // flashcards tile opens the existing study directly when the deck exists
  // (「继续学习」), the launcher dialog when it doesn't (T3's policy — cards
  // are never silently duplicated).
  const quizable = quizableMaterials(materials);
  const tiles = [
    {
      icon: ListChecks,
      label: t("plans.quickQuiz"),
      desc: t("plans.quickQuizDesc"),
      testId: "task-quiz-tile",
      off: quizable.length === 0,
      run: () => setQuizOpen(true),
    },
    hasCards
      ? {
          icon: Layers,
          label: t("flashcards.tileContinue"),
          desc: t("flashcards.tileContinueDesc", { n: taskCards.length }),
          testId: "task-flashcards-tile",
          off: false, // an existing deck opens without parsed sections
          run: () => navigate(`/task/${task.id}/flashcards`),
        }
      : {
          icon: Layers,
          label: t("plans.quickFlashcards"),
          desc: t("plans.quickFlashcardsDesc"),
          testId: "task-flashcards-tile",
          off: quizable.length === 0,
          run: () => setFlashcardsOpen(true),
        },
  ] as const;

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
      {/* the real picker behind the row's re-upload affordance */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.markdown,.pptx,application/pdf,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          handleReupload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <div className="min-w-0">
          <p className="eyebrow">{t("tasks.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{title}</h1>
          {/* FR-37 stretch (epic-14 T2): the promote entry — a confirm-gated
              product action (the content becomes a standalone plan). A
              promoted task never sees it (the pointer card replaces it). */}
          {!promoted && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="task-promote-button"
              className="mt-2 gap-1.5 rounded-full"
              onClick={() => setPromoteOpen(true)}
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              {t("tasks.promoteAction")}
            </Button>
          )}
        </div>
        <div>
          <MasteryRing value={view.score} size={72} />
          <ContractNote>{t("tasks.rollupNote")}</ContractNote>
        </div>
      </div>

      {/* The promoted pointer card (epic-14 T2): the honest supersession —
          the task names the plan it became and deep-links to it; the study
          record (the ring + the node row below) stays readable. */}
      {promoted && task.promotedPlanId && (
        <div
          data-testid="task-promoted-card"
          className="mt-4 rounded-2xl border border-border-soft bg-card shadow-raised p-4 flex flex-wrap items-center gap-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full tint-green flex-none" aria-hidden="true">
            <ArrowUpRight className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("tasks.promotedCardTitle")}</p>
            <p className="text-xs text-muted-foreground truncate">
              {task.promotedPlan?.topic ?? title} · {t("tasks.promotedCardNote")}
            </p>
          </div>
          <Link
            to={`/plan/${task.promotedPlanId}`}
            data-testid="task-promoted-plan-link"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
          >
            {t("tasks.viewPlan")}
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-5 items-start">
        {/* left zone: the single owned node + the single material */}
        <div className="min-w-0">
          <section className="mb-5">
            <h2 className="eyebrow mb-2">{t("tasks.nodeSection")}</h2>
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
              {node && <NodeEvidenceRow node={node} view={view} />}
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-2">{t("plans.materialsSection")}</h2>
            {material ? (
              <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                <MaterialRow
                  material={material}
                  readOnly={promoted}
                  onReupload={() => fileInputRef.current?.click()}
                  onRetryParse={(materialId) => parseMaterial.mutate(materialId)}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-1">{t("plans.materialsEmpty")}</p>
            )}
          </section>
        </div>

        {/* right zone: quick actions — the real launches (T4). A promoted
            task has NO writable actions (no re-quiz, no re-generation) — the
            tiles zone disappears entirely, the pointer card speaks. */}
        {!promoted && (
          <div className="space-y-4">
            <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
              <h2 className="eyebrow mb-3">{t("plans.quickActions")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {tiles.map((tile) => (
                  <button
                    key={tile.label}
                    type="button"
                    data-testid={tile.testId}
                    aria-label={tile.label}
                    aria-disabled={tile.off}
                    title={tile.off ? t("plans.needMaterial") : undefined}
                    onClick={() => {
                      // Gated tiles name the gate (a parsed material), never the roadmap.
                      if (tile.off) toast(t("plans.needMaterial"));
                      else tile.run();
                    }}
                    className={cn(
                      "text-left rounded-xl border border-border-soft p-3 transition-colors cursor-pointer",
                      tile.off ? "opacity-50" : "hover:bg-[var(--glass-2)]",
                    )}
                  >
                    <tile.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                    <p className="text-[13px] font-semibold mt-1.5">{tile.label}</p>
                    <p className="text-[10px] text-muted-foreground">{tile.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FR-37 stretch (epic-14 T2): the promote confirm — bilingual copy
          names the honest deal (the content becomes a standalone plan, the
          study record carries over). On success the route moves to the new
          plan (the pointer is a hand-off, not a dead end); the plans-list
          read-back sweep runs in the hook. */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border-soft bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("tasks.promoteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("tasks.promoteBody")}</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="task-promote-cancel"
              onClick={() => setPromoteOpen(false)}
            >
              {t("tasks.promoteCancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="task-promote-confirm"
              disabled={promote.loading}
              onClick={async () => {
                if (!task) return;
                try {
                  const result = await promote.mutate({
                    variables: { input: { taskId: task.id, clientUuid: newClientUuid() } },
                  });
                  const planId = result.data?.promoteTaskToPlan.plan.id;
                  if (planId) {
                    setPromoteOpen(false);
                    navigate(`/plan/${planId}`);
                  }
                } catch {
                  // The hook's onError already toasted (the neutral
                  // persistence-failure posture) — the dialog stays open for
                  // the retry; nothing else to do here.
                }
              }}
            >
              {promote.loading ? t("tasks.promoting") : t("tasks.promoteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* T4: the quiz launcher — mode select only (the single material IS the
          scope). On success the route carries the session id (resumable); the
          session is created with planId null, taskId set (AD-6). */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("quiz.launcher.title")}</DialogTitle>
          </DialogHeader>
          {task && node && (
            <QuizLauncher
              taskId={task.id}
              nodeIds={[node.id]}
              materials={materials}
              onStarted={(sessionId) => {
                setQuizOpen(false);
                navigate(`/task/${task.id}/quiz?session=${sessionId}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* T4: the flashcards launcher — 「来自 N 份材料 · 正在生成闪卡」
          cancellable, failure toast; on success the study route takes over.
          A task that already has cards never reaches this dialog (the tile
          opens the existing study directly — no silent deck duplication). */}
      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("flashcards.launcher.title")}</DialogTitle>
          </DialogHeader>
          {task && (
            <FlashcardLauncher
              materials={materials}
              onCreated={() => {
                setFlashcardsOpen(false);
                navigate(`/task/${task.id}/flashcards`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The task's single node row (UX display contract): state glyph + tint + label
 * (never color alone), the domain score when evidence exists (em-dash
 * otherwise), and an evidence popover listing what moved the number — the
 * window's outcome marks, the legend, the shared rule, and the cap-99 note
 * while the node sits under the anti-inflation gate (ADR-0001).
 */
function NodeEvidenceRow({ node, view }: { node: KnowledgeNodeView; view: TaskMasteryView }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <NodeStateBadge state={view.state} />
      <span className="text-sm font-medium truncate flex-1">{node.title}</span>
      <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">
        {view.hasEvidence ? `${view.score}%` : "—"}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("plans.viewEvidenceAria")}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-xs">
          <p className="font-semibold mb-2">{node.title}</p>
          <div className="flex items-center gap-1.5 mb-2">
            {view.lastOutcomes.length === 0 ? (
              <span className="text-muted-foreground">{t("plans.noEvidence")}</span>
            ) : (
              view.lastOutcomes.map((outcome, i) => <OutcomeMark key={`${outcome}-${i}`} outcome={outcome} />)
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2 text-[10px] text-muted-foreground">
            {(["correct", "partial", "wrong"] as const).map((outcome) => (
              <span key={outcome} className="inline-flex items-center gap-1">
                <OutcomeMark outcome={outcome} small />
                {t(OUTCOME_LABEL_KEY[outcome])}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground leading-[1.5]">{t("plans.evidenceRule")}</p>
          {view.belowGate && (
            <p className="text-muted-foreground leading-[1.5] mt-1.5">
              {t("tasks.cap99Note", { n: MASTERY_CONFIG.evidenceGate })}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * The task's material row — the Plan Home row's single-material twin: opens
 * the Immersive Reader (继续阅读 when stored progress exists, 打开 when not),
 * an honest parse chip while the session bytes are present, and the re-upload
 * contract once the bytes are gone after a reload (FR-29 — metadata persists,
 * bytes do not; the declarative `useSessionBlob` subscription re-renders the
 * row when bytes arrive). Parse failure keeps the bilingual reason and the
 * retry affordance; the reader hosts the honest state for every state the
 * link lands on. `readOnly` (the promoted pointer, epic-14 T2) keeps the row
 * informational — the reader link stays (reading is not a write), every
 * mutation affordance (re-upload, parse retry) goes.
 */
function MaterialRow({
  material,
  readOnly = false,
  onReupload,
  onRetryParse,
}: {
  material: Material;
  readOnly?: boolean;
  onReupload: () => void;
  onRetryParse: (materialId: string) => void;
}) {
  const { t } = useLanguage();
  // useSessionBlob is a hook — it runs on every render; readOnly only gates
  // the derived affordance, never the subscription.
  const hasSessionBlob = useSessionBlob(material.id);
  const needsReupload = !readOnly && !hasSessionBlob;
  const progressQuery = useReadingProgressQuery(material.id);
  const hasProgress = !!progressQuery.data;
  const openLabelKey = hasProgress ? "plans.continueReading" : "common.open";
  const kind = material.kind === "pdf" ? t("plans.materialKindPdf") : t("plans.materialKindMarkdown");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
      <span className="text-sm truncate flex-1">{material.title}</span>
      <Link
        to={`/read/${material.id}`}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
        title={t(openLabelKey)}
      >
        <BookOpen className="w-3 h-3" aria-hidden="true" /> {t(openLabelKey)}
      </Link>
      {/* secondary metadata chips drop below `sm` so the recovery action (FR-29)
          never clips off-screen at phone widths — the row wraps instead */}
      <span className="hidden sm:inline text-[10px] uppercase tracking-wide text-muted-foreground flex-none">{kind}</span>
      <span className="hidden sm:inline text-[10px] text-muted-foreground tabular-nums flex-none">
        {t("plans.sizeMb", { n: (material.sizeBytes / 1e6).toFixed(1) })}
      </span>
      {readOnly ? (
        material.parseState === "parsed" ? (
          <span className="pill pill-mastered flex-none">
            {t("plans.parseParsed", { n: material.sections.length })}
          </span>
        ) : (
          <span className="pill pill-muted flex-none">{t("plans.parsePending")}</span>
        )
      ) : needsReupload ? (
        <span className="flex items-center gap-2 flex-none">
          <span className="pill pill-muted cursor-help" title={t("plans.materialsSessionNote")}>
            {t("plans.materialReupload")}
          </span>
          <button
            type="button"
            onClick={onReupload}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline"
          >
            <Upload className="w-3 h-3" aria-hidden="true" /> {t("plans.materialReuploadAction")}
          </button>
        </span>
      ) : material.parseState === "failed" ? (
        <span className="flex items-center gap-2 flex-none">
          <span
            className="pill tint-danger cursor-help"
            title={t(PARSE_REASON_MESSAGE_KEY[material.parseFailureReason ?? "unknown"])}
          >
            {t("plans.parseFailed")}
          </span>
          <button
            type="button"
            onClick={() => onRetryParse(material.id)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline"
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" /> {t("plans.parseRetry")}
          </button>
        </span>
      ) : material.parseState === "parsing" ? (
        <span className="pill pill-muted flex-none">{t("plans.parseParsing")}</span>
      ) : material.parseState === "parsed" ? (
        <span className="pill pill-mastered flex-none">
          {t("plans.parseParsed", { n: material.sections.length })}
        </span>
      ) : (
        <span className="pill pill-muted cursor-help flex-none" title={t("plans.parsePendingNote")}>
          {t("plans.parsePending")}
        </span>
      )}
    </div>
  );
}
