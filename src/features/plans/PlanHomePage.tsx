/**
 * Plan Home light (FR-25; Q7; AD-8): the two-zone overview — stage-grouped
 * nodes + materials on the left, attach CTA + quick actions + recent activity
 * on the right. Every number is the shipped domain seam over real evidence
 * queries (ADR-0001: no display arithmetic); a fresh plan reads all-uncovered
 * honestly and lights up when slice 6 produces evidence. Read-only materials
 * with the parse-pending chip (the upload dropzone is the next ticket and
 * lands in the materials section). Quick actions never promise dead clicks:
 * generation tiles explain their slice, upload points at the materials section.
 */
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Info, Layers, ListChecks, MessageCircle, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAllEvidenceQuery, usePlanMaterialsQuery, usePlanNodesQuery, usePlanQuery } from "@/data";
import type { Material } from "@/domain/entities";
import {
  evidenceStreak,
  nodeRowViews,
  planCardMetrics,
  planRecentActivity,
  stageGroups,
  type NodeRowView,
} from "./display-shaping";
import { ContractNote, MasteryRing, OutcomeMark, StateGlyph, StreakChip } from "./atoms";

export default function PlanHomePage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const planQuery = usePlanQuery(id ?? "");
  const nodesQuery = usePlanNodesQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");
  const evidenceQuery = useAllEvidenceQuery();
  const materialsRef = useRef<HTMLElement>(null);

  const scrollToMaterials = () => materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (planQuery.isPending || nodesQuery.isPending || materialsQuery.isPending || evidenceQuery.isPending) return null;
  const plan = planQuery.data;
  const nodes = nodesQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const evidence = evidenceQuery.data ?? [];

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

  const actions = [
    { icon: ListChecks, label: t("plans.quickQuiz"), desc: t("plans.quickQuizDesc"), off: !hasMaterials, slice: "plans.sliceQuiz" },
    { icon: Layers, label: t("plans.quickFlashcards"), desc: t("plans.quickFlashcardsDesc"), off: !hasMaterials, slice: "plans.sliceFlashcards" },
    { icon: Upload, label: t("plans.quickUpload"), desc: t("plans.quickUploadDesc"), off: false, slice: null },
    { icon: MessageCircle, label: t("plans.quickCompanion"), desc: t("plans.quickCompanionDesc"), off: false, slice: "plans.sliceCompanion" },
  ] as const;

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
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

          <section ref={materialsRef}>
            <h2 className="eyebrow mb-2">{t("plans.materialsSection")}</h2>
            {materials.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">{t("plans.materialsEmpty")}</p>
            ) : (
              <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
                {materials.map((material) => (
                  <MaterialRow key={material.id} material={material} />
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
              onClick={scrollToMaterials}
              className="w-full rounded-2xl border-[1.5px] border-dashed border-[var(--accent-edge)] bg-[var(--accent-tint)] px-4 py-6 text-center cursor-pointer hover:bg-[var(--accent-tint-2)] transition-colors"
            >
              <Upload className="w-5 h-5 mx-auto text-accent-ink" aria-hidden="true" />
              <p className="text-sm font-semibold mt-2">{t("plans.attachCta")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{t("plans.attachCtaHint")}</p>
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
                  onClick={() => (action.slice ? toast(t(action.slice)) : scrollToMaterials())}
                  className={`text-left rounded-xl border border-border-soft p-3 transition-colors cursor-pointer ${
                    action.off ? "opacity-50" : "hover:bg-[var(--glass-2)]"
                  }`}
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
                      {new Date(entry.latestAt).toLocaleDateString(language === "zh" ? "zh-CN" : "en-US")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
                {outcome === "correct" ? t("plans.outcomeCorrect") : outcome === "partial" ? t("plans.outcomePartial") : t("plans.outcomeWrong")}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground leading-[1.5]">{t("plans.evidenceRule")}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Read-only material row (Q1): kind + size + honest parse-pending chip. Upload lands here next ticket. */
function MaterialRow({ material }: { material: Material }) {
  const { t } = useLanguage();
  const kind = material.kind === "pdf" ? t("plans.materialKindPdf") : t("plans.materialKindMarkdown");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
      <span className="text-sm truncate flex-1">{material.title}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-none">{kind}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
        {t("plans.sizeMb", { n: (material.sizeBytes / 1e6).toFixed(1) })}
      </span>
      {material.parseState === "pending" && (
        <span className="pill pill-muted cursor-help flex-none" title={t("plans.parsePendingNote")}>
          {t("plans.parsePending")}
        </span>
      )}
    </div>
  );
}
