/**
 * Task Home — /task/:id (T2; FR-37; AD-6/8): the single-material twin of Plan
 * Home, the task's stable home address beyond the reader. Breadcrumb back to
 * Plans Home (the task is never a trap); the material row opens the Immersive
 * Reader and offers re-upload when the session-only bytes are gone after a
 * reload — through the reader's own re-upload contract (kind-matched
 * validateReupload + sessionBlobs.put, pending/failed re-parse; AD-7); the
 * Mastery Ring shows the task rollup — exactly its single owned node's score
 * via `computeTaskRollup` through pure display-shaping selectors, never a
 * share-of-mastered collapse (ADR-0001) — with the shared state vocabulary
 * (uncovered/partial/mastered, glyph + label) and an evidence popover that
 * names what moved the number, including the cap-99-below-gate behavior. Quiz
 * and flashcard tiles are visible, disabled placeholders pointing at epic-6
 * (Plan Home parity); Companion is reached via the reader — no duplicate
 * surface here. No upload zone: a task is strictly 1:1 with its material.
 */
import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, Layers, ListChecks, RotateCw, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  sessionBlobs,
  useAllEvidenceQuery,
  useReadingProgressQuery,
  useTaskMaterialsQuery,
  useTaskNodeQuery,
  useTaskQuery,
} from "@/data";
import { cn } from "@/lib/utils";
import type { KnowledgeNode, Material } from "@/domain/entities";
import { MASTERY_CONFIG } from "@/domain/mastery";
import { ContractNote, MasteryRing, OutcomeMark, OUTCOME_LABEL_KEY, StateGlyph, useSessionBlob } from "@/features/plans";
import { PARSE_REASON_MESSAGE_KEY, useParseMaterialMutation, validateReupload } from "@/features/reader";
import { taskMasteryView, type TaskMasteryView } from "./display-shaping";

export default function TaskHomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const taskQuery = useTaskQuery(id ?? "");
  const nodeQuery = useTaskNodeQuery(id ?? "");
  const materialsQuery = useTaskMaterialsQuery(id ?? "");
  const evidenceQuery = useAllEvidenceQuery();
  const parseMaterial = useParseMaterialMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (taskQuery.isPending || nodeQuery.isPending || materialsQuery.isPending || evidenceQuery.isPending) return null;
  const task = taskQuery.data;
  const node = nodeQuery.data;
  const materials = materialsQuery.data ?? [];
  const material = materials[0]; // strictly 1:1 (StudyTask ||--|| Material) — no upload zone
  const evidence = evidenceQuery.data ?? [];

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
  // re-upload card semantics, through its public contract).
  const handleReupload = (file: File | undefined) => {
    if (!file || !material) return;
    const verdict = validateReupload(file, material.kind);
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    sessionBlobs.put(material.id, file);
    if (material.parseState === "pending" || material.parseState === "failed") {
      parseMaterial.mutate(material.id);
    }
  };

  // Epic-6 placeholders (spec decision 1): visible, disabled, with a reason —
  // the material is always attached here, so the reason is the slice, never a gate.
  const tiles = [
    { icon: ListChecks, label: t("plans.quickQuiz"), desc: t("plans.quickQuizDesc"), reason: "tasks.sliceQuiz" },
    { icon: Layers, label: t("plans.quickFlashcards"), desc: t("plans.quickFlashcardsDesc"), reason: "tasks.sliceFlashcards" },
  ] as const;

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
      {/* the real picker behind the row's re-upload affordance */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.markdown,application/pdf,text/markdown"
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
        </div>
        <div>
          <MasteryRing value={view.score} size={72} />
          <ContractNote>{t("tasks.rollupNote")}</ContractNote>
        </div>
      </div>

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
                  onReupload={() => fileInputRef.current?.click()}
                  onRetryParse={(materialId) => parseMaterial.mutate(materialId)}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-1">{t("plans.materialsEmpty")}</p>
            )}
          </section>
        </div>

        {/* right zone: epic-6 placeholders */}
        <div className="space-y-4">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4">
            <h2 className="eyebrow mb-3">{t("plans.quickActions")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  aria-label={tile.label}
                  aria-disabled="true"
                  title={t(tile.reason)}
                  onClick={() => toast(t(tile.reason))}
                  className="text-left rounded-xl border border-border-soft p-3 transition-colors cursor-pointer opacity-50"
                >
                  <tile.icon className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                  <p className="text-[13px] font-semibold mt-1.5">{tile.label}</p>
                  <p className="text-[10px] text-muted-foreground">{tile.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
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
function NodeEvidenceRow({ node, view }: { node: KnowledgeNode; view: TaskMasteryView }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <StateGlyph state={view.state} />
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
 * link lands on.
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
