/**
 * Plan Home light (FR-25; Q7; AD-8): the two-zone overview — stage-grouped
 * nodes + materials on the left, attach CTA + quick actions + recent activity
 * on the right. Every number is the shipped domain seam over real evidence
 * queries (ADR-0001: no display arithmetic); a fresh plan reads all-uncovered
 * honestly and lights up when slice 6 produces evidence. Materials attach via
 * the upload dropzone (FR-2; Q1): PDF/Markdown ≤ 20MB, validated by the pure
 * validators, registered pending-parse with bytes in the session-blob registry
 * only (AD-4), then parsed eagerly by the reader's parse(file) API (AD-7) —
 * the row's chip walks pending → parsing → parsed | failed (+ retry while the
 * bytes exist). After a reload rows honestly ask for the file again; a
 * re-upload of a pending/failed material re-runs the parse. Quick actions
 * never promise dead clicks: generation tiles explain their slice, upload
 * opens the real file picker.
 */
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, Info, Layers, ListChecks, MessageCircle, RotateCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuizLauncher, quizableMaterials } from "@/features/quiz";
import { FlashcardLauncher } from "@/features/flashcards";
import {
  sessionBlobs,
  useAllEvidenceQuery,
  useFlashcardsByPlanQuery,
  usePlanMaterialsQuery,
  usePlanNodesQuery,
  usePlanQuery,
  useReadingProgressQuery,
  useRegisterMaterialMutation,
} from "@/data";
import { cn } from "@/lib/utils";
import type { Material } from "@/domain/entities";
import { PARSE_REASON_MESSAGE_KEY, useParseMaterialMutation } from "@/features/reader";
import {
  evidenceStreak,
  nodeRowViews,
  planCardMetrics,
  planRecentActivity,
  stageGroups,
  type NodeRowView,
} from "./display-shaping";
import { localeTag } from "./locale";
import { OUTCOME_LABEL_KEY } from "./outcome-labels";
import { validateUpload } from "./upload-validation";
import { useSessionBlob } from "./use-session-blob";
import { ContractNote, MasteryRing, OutcomeMark, StateGlyph, StreakChip } from "./atoms";

export default function PlanHomePage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const planQuery = usePlanQuery(id ?? "");
  const nodesQuery = usePlanNodesQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");
  const evidenceQuery = useAllEvidenceQuery();
  // Epic-6 T3: the flashcards entry reads the plan's persisted deck — cards
  // exist → the tile opens the study directly (「继续学习」); none → the
  // FlashcardLauncher dialog generates through the AI seam.
  const flashcardsQuery = useFlashcardsByPlanQuery(id ?? "");
  const registerMaterial = useRegisterMaterialMutation();
  const parseMaterial = useParseMaterialMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The picker serves two flows: null = attach a new material; a material id = re-upload
  // that row's session bytes (FR-29 contract — metadata persists, bytes do not).
  const pickerTargetRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Epic-6 T2: the quiz quick action opens the QuizLauncher dialog (mode +
  // scope) instead of the placeholder toast — when quizable materials exist.
  const [quizOpen, setQuizOpen] = useState(false);
  // Epic-6 T3: the flashcards quick action — the FlashcardLauncher dialog when
  // the plan has no cards yet.
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);

  const openPicker = (materialId: string | null = null) => {
    pickerTargetRef.current = materialId;
    fileInputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    const planId = id;
    if (!file || !planId) return;
    const verdict = validateUpload(file);
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    const reuploadId = pickerTargetRef.current;
    pickerTargetRef.current = null;
    if (reuploadId) {
      // Re-upload: same Material metadata, fresh session-only bytes. The row
      // re-renders via its useSessionBlob subscription (no manual tick). A
      // pending/failed material now has bytes again — retry the parse (AD-7).
      sessionBlobs.put(reuploadId, file);
      const target = materialsQuery.data?.find((m) => m.id === reuploadId);
      if (target && (target.parseState === "pending" || target.parseState === "failed")) {
        parseMaterial.mutate(reuploadId);
      }
      return;
    }
    // Register pending-parse (AD-7), then hand the fresh bytes to the reader's
    // parse(file) eagerly — bytes exist only now, so this is the moment the
    // extracted sections are captured for persistence.
    registerMaterial.mutate(
      {
        title: verdict.title,
        kind: verdict.kind,
        sizeBytes: file.size,
        planId,
        taskId: null,
        blob: file,
        sections: [],
        parseState: "pending",
      },
      { onSuccess: ({ material }) => parseMaterial.mutate(material.id) },
    );
  };

  if (planQuery.isPending || nodesQuery.isPending || materialsQuery.isPending || evidenceQuery.isPending || flashcardsQuery.isPending) return null;
  const plan = planQuery.data;
  const nodes = nodesQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const evidence = evidenceQuery.data ?? [];
  const planCards = flashcardsQuery.data ?? [];
  const hasCards = planCards.length > 0;

  const backLink = (
    <button
      type="button"
      onClick={() => navigate("/plans")}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {t("plans.backToPlans")}
    </button>
  );

  if (!plan) {
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        {backLink}
        <p className="page-title mt-6 text-lg">{t("plans.notFound")}</p>
      </div>
    );
  }

  const metrics = planCardMetrics(nodes, evidence);
  const activity = planRecentActivity(nodes, evidence);
  const hasMaterials = materials.length > 0;
  // Quiz generation needs parsed sections (FR-18 sourcing honesty) — pending/
  // failed/empty materials cannot serve a quiz, so they don't unlock the tile.
  const quizable = quizableMaterials(materials);

  const actions = [
    {
      icon: ListChecks,
      label: t("plans.quickQuiz"),
      desc: t("plans.quickQuizDesc"),
      off: quizable.length === 0,
      run: () => setQuizOpen(true),
    },
    {
      icon: Layers,
      label: hasCards ? t("flashcards.tileContinue") : t("plans.quickFlashcards"),
      desc: hasCards ? t("flashcards.tileContinueDesc", { n: planCards.length }) : t("plans.quickFlashcardsDesc"),
      // Generation needs parsed sections; an existing deck opens without them.
      off: !hasCards && quizable.length === 0,
      run: hasCards
        ? () => navigate(`/plan/${plan.id}/flashcards`)
        : () => setFlashcardsOpen(true),
    },
    { icon: Upload, label: t("plans.quickUpload"), desc: t("plans.quickUploadDesc"), off: false, run: () => openPicker() },
    {
      icon: MessageCircle,
      label: t("plans.quickCompanion"),
      desc: t("plans.quickCompanionDesc"),
      off: false,
      run: () => toast(t("plans.sliceCompanion")),
    },
  ] as const;

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
      {/* the real picker behind every attach affordance (CTA card, header action, quick tile, row re-upload) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.markdown,application/pdf,text/markdown"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <div className="min-w-0">
          <p className="eyebrow">{t("plans.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{plan.topic}</h1>
          {plan.goal && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("plans.goalLabel")}
              {plan.goal}
            </p>
          )}
        </div>
        <div className="flex items-start gap-5">
          <StreakChip days={evidenceStreak(evidence)} />
          <div>
            <MasteryRing value={metrics.rollup} size={72} />
            <ContractNote>{t("plans.rollupNote")}</ContractNote>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-5 items-start">
        {/* left zone: nodes + materials */}
        <div className="min-w-0">
          {stageGroups(nodeRowViews(nodes, evidence)).map((group) => (
            <section key={group.stage ?? t("plans.stageUntitled")} className="mb-5">
              <h2 className="eyebrow mb-2">{group.stage ?? t("plans.stageUntitled")}</h2>
              <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                {group.rows.map((view) => (
                  <NodeRow key={view.node.id} view={view} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="eyebrow">{t("plans.materialsSection")}</h2>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={() => openPicker()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink cursor-pointer"
                >
                  <Upload className="w-3 h-3" aria-hidden="true" /> {t("plans.materialsUpload")}
                </button>
              )}
            </div>
            {materials.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">{t("plans.materialsEmpty")}</p>
            ) : (
              <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                {materials.map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    onReupload={() => openPicker(material.id)}
                    onRetryParse={(materialId) => parseMaterial.mutate(materialId)}
                  />
                ))}
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[11px] leading-[1.5] text-muted-foreground mt-2 px-1">
              <Info className="w-3 h-3 mt-[2px] flex-none" aria-hidden="true" />
              {t("plans.materialsSessionNote")}
            </p>
          </section>
        </div>

        {/* right zone: attach CTA + quick actions + activity */}
        <div className="space-y-4">
          {!hasMaterials && (
            <button
              type="button"
              onClick={() => openPicker()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                "w-full rounded-2xl border-[1.5px] border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-[var(--accent-ring)] bg-[var(--accent-tint-2)]"
                  : "border-[var(--accent-edge)] bg-[var(--accent-tint)] hover:bg-[var(--accent-tint-2)]",
              )}
            >
              <Upload className="w-5 h-5 mx-auto text-accent-ink" aria-hidden="true" />
              <p className="text-sm font-semibold mt-2">{t("plans.attachCta")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {dragOver ? t("plans.attachDropActive") : t("plans.attachCtaHint")}
              </p>
            </button>
          )}

          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{t("plans.quickActions")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  aria-disabled={action.off}
                  title={action.off ? t("plans.needMaterial") : undefined}
                  onClick={() => {
                    // Gated tiles name the gate (attach a material), never the roadmap.
                    if (action.off) toast(t("plans.needMaterial"));
                    else action.run();
                  }}
                  className={cn(
                    "text-left rounded-xl border border-border-soft p-3 transition-colors cursor-pointer",
                    action.off ? "opacity-50" : "hover:bg-[var(--glass-2)]",
                  )}
                >
                  <action.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                  <p className="text-[13px] font-semibold mt-1.5">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{t("plans.recentActivity")}</h2>
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-[1.5]">{t("plans.recentEmpty")}</p>
            ) : (
              <div className="space-y-3">
                {activity.map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <p className="font-semibold leading-[1.4] truncate">{entry.nodeTitle}</p>
                    <p className="text-muted-foreground mt-0.5">
                      {t("plans.activityMeta", { score: entry.score, n: entry.recordCount })} ·{" "}
                      {new Date(entry.latestAt).toLocaleDateString(localeTag(language))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Epic-6 T2: the quiz launcher — mode + scope, generating cancellable,
          failure toast. On success the route carries the session id (resumable). */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("quiz.launcher.title")}</DialogTitle>
          </DialogHeader>
          <QuizLauncher
            planId={plan.id}
            nodeIds={nodes.map((n) => n.id)}
            materials={materials}
            onStarted={(sessionId) => {
              setQuizOpen(false);
              navigate(`/plan/${plan.id}/quiz?session=${sessionId}`);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Epic-6 T3: the flashcards launcher — 「来自 N 份材料 · 正在生成闪卡」
          cancellable, failure toast; on success the study route takes over.
          A plan that already has cards never reaches this dialog (the tile
          opens the existing study directly — no silent deck duplication). */}
      <Dialog open={flashcardsOpen} onOpenChange={setFlashcardsOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("flashcards.launcher.title")}</DialogTitle>
          </DialogHeader>
          <FlashcardLauncher
            materials={materials}
            onCreated={() => {
              setFlashcardsOpen(false);
              navigate(`/plan/${plan.id}/flashcards`);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** One node row (UX display contract): state glyph + tint + label, score when evidence exists, evidence popover. */
function NodeRow({ view }: { view: NodeRowView }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <StateGlyph state={view.state} />
      <span className="text-sm font-medium truncate flex-1">{view.node.title}</span>
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
          <p className="font-semibold mb-2">{view.node.title}</p>
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
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * One material row (Q1): kind + size + an honest parse chip while the session
 * bytes are present — pending → parsing → parsed, or failed with its bilingual
 * reason (tooltip) and a retry action that re-runs the reader's parse from the
 * session blob (only while the bytes exist, AD-7). Once the bytes are gone
 * (reload), the row names the contract — re-upload needed — with an affordance
 * that opens the picker for that row. Byte presence is a declarative
 * `useSessionBlob` subscription, so the row itself re-renders when bytes are
 * attached or re-uploaded. Every row also opens the Immersive Reader
 * (/read/:materialId) — the reader hosts the honest state for whatever the
 * parse is doing (FR-8; T2). The link reads 继续阅读 when stored reading
 * progress exists for the material, 打开 when not (FR-25 continue-reading
 * entry points; the reader itself decides what the stored position restores).
 */
function MaterialRow({
  material,
  onReupload,
  onRetryParse,
}: {
  material: Material;
  onReupload: () => void;
  onRetryParse: (materialId: string) => void;
}) {
  const { t } = useLanguage();
  const needsReupload = !useSessionBlob(material.id);
  const progressQuery = useReadingProgressQuery(material.id);
  const hasProgress = !!progressQuery.data;
  const openLabelKey = hasProgress ? "plans.continueReading" : "common.open";
  const kind = material.kind === "pdf" ? t("plans.materialKindPdf") : t("plans.materialKindMarkdown");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
      <span className="text-sm truncate flex-1">{material.title}</span>
      {/* Open in the Immersive Reader (FR-8; T2) — every state lands honestly
          there: parsing shows the skeleton, failed the reason card, and a
          byteless parsed material the re-upload affordance. */}
      <Link
        to={`/read/${material.id}`}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
        title={t(openLabelKey)}
      >
        <BookOpen className="w-3 h-3" aria-hidden="true" /> {t(openLabelKey)}
      </Link>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-none">{kind}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
        {t("plans.sizeMb", { n: (material.sizeBytes / 1e6).toFixed(1) })}
      </span>
      {needsReupload ? (
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
