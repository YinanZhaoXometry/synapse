import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  useAllEvidenceQuery,
  useAllMaterialsQuery,
  useAllReadingProgressQuery,
  usePlanMaterialsQuery,
  usePlanNodesQuery,
  usePlansQuery,
} from "@/data";
import type { EvidenceRecord, StudyPlan } from "@/domain/entities";
import { latestReading, mostRecentPlan, planCardMetrics, type LatestReadingView } from "./display-shaping";
import { localeTag } from "./locale";
import { MasteryRing, StateMiniBar } from "./atoms";
import CreationChat from "./CreationChat";

/**
 * Plans Home (AD-8; FR-1; Q3/Q5) — the front door. Empty state: the creation
 * chat is the primary surface (SM-1, no seeded demo data). Returning state:
 * continue hero for the most recent plan (rollup + recency) + the 「上次读到」
 * line from the most recent reading across plans (FR-25; epic-2's deferral
 * closes here) + plan cards with honest rollup chips and node-state mini bars
 * + a create-new action. No task section — Study Tasks land in slice 5.
 */
export default function PlansHomePage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const plansQuery = usePlansQuery();
  const evidenceQuery = useAllEvidenceQuery();

  if (plansQuery.isPending || evidenceQuery.isPending) return null;
  const plans = plansQuery.data ?? [];
  const evidence = evidenceQuery.data ?? [];
  const isEmpty = plans.length === 0;

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("plans.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{isEmpty ? t("plans.emptyTitle") : t("plans.returningTitle")}</h1>
        </div>
        {!isEmpty && (
          <Button variant="outline" onClick={() => navigate("/plan/new")}>
            <Plus className="w-4 h-4 mr-1.5" /> {t("plans.createNew")}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <CreationChat />
      ) : (
        <ReturningHome plans={plans} evidence={evidence} language={language} />
      )}
    </div>
  );
}

/** Returning state (Q5): continue hero + plan cards, numbers from the domain seam only. */
function ReturningHome({
  plans,
  evidence,
  language,
}: {
  plans: StudyPlan[];
  evidence: EvidenceRecord[];
  language: "zh" | "en";
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const hero = mostRecentPlan(plans);
  const recency = hero ? new Date(hero.createdAt).toLocaleDateString(localeTag(language)) : null;
  // The 「上次读到」 line (FR-25; T4): the most recent resumable reading across
  // plans — shaped by the pure selector over the cross-material queries; while
  // they settle (and when nothing is resumable) the line stays hidden honestly.
  const materialsQuery = useAllMaterialsQuery();
  const progressQuery = useAllReadingProgressQuery();
  const reading = latestReading(progressQuery.data ?? [], materialsQuery.data ?? []);

  return (
    <>
      {hero && recency && (
        <button
          type="button"
          onClick={() => navigate(`/plan/${hero.id}`)}
          className="w-full text-left bg-card border border-border-soft rounded-2xl shadow-raised p-5 mt-4 flex items-center gap-5 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
        >
          <ContinueHeroBody plan={hero} evidence={evidence} recency={recency} reading={reading} />
          <span className="pill pill-mastered flex-none">{t("plans.continueAction")}</span>
        </button>
      )}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} evidence={evidence} />
        ))}
      </div>
    </>
  );
}

/** Hero rollup: the hero card's own nodes via its query (rollup + counts) + the last-read line. */
function ContinueHeroBody({
  plan,
  evidence,
  recency,
  reading,
}: {
  plan: StudyPlan;
  evidence: EvidenceRecord[];
  recency: string;
  reading: LatestReadingView | null;
}) {
  const { t } = useLanguage();
  const nodesQuery = usePlanNodesQuery(plan.id);
  const materialsQuery = usePlanMaterialsQuery(plan.id);
  const nodes = nodesQuery.data ?? [];
  const metrics = planCardMetrics(nodes, evidence);
  return (
    <>
      <MasteryRing value={metrics.rollup} size={64} />
      <div className="flex-1 min-w-0">
        <p className="eyebrow">
          {t("plans.continueEyebrow")} · {recency}
        </p>
        <p className="font-display font-bold text-lg leading-snug truncate mt-0.5">{plan.topic}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {nodes.length} {t("plans.nodesUnit")} · {(materialsQuery.data ?? []).length} {t("plans.materialsUnit")}
        </p>
        {reading && (
          <p className="text-[11px] text-accent-ink leading-[1.5] truncate mt-1.5">
            {reading.locator.kind === "pdf"
              ? t("plans.lastReadPage", { material: reading.material.title, n: reading.locator.page })
              : t("plans.lastReadSection", {
                  material: reading.material.title,
                  section: reading.sectionTitle ?? "",
                })}
          </p>
        )}
      </div>
    </>
  );
}

/** One plan card (Q5): honest rollup chip + node-state mini bar + node/material counts. */
function PlanCard({ plan, evidence }: { plan: StudyPlan; evidence: EvidenceRecord[] }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const nodesQuery = usePlanNodesQuery(plan.id);
  const materialsQuery = usePlanMaterialsQuery(plan.id);
  const nodes = nodesQuery.data ?? [];
  const metrics = planCardMetrics(nodes, evidence);
  return (
    <button
      type="button"
      onClick={() => navigate(`/plan/${plan.id}`)}
      className="text-left bg-card border border-border-soft rounded-2xl shadow-raised p-4 cursor-pointer hover:border-[var(--accent-edge)] transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm truncate">{plan.topic}</p>
        <span className="font-display font-bold tabular-nums text-sm text-accent-ink flex-none">
          {metrics.rollup}%
        </span>
      </div>
      <StateMiniBar counts={metrics.stateCounts} />
      <p className="text-[11px] text-muted-foreground mt-2">
        {nodes.length} {t("plans.nodesUnit")} · {(materialsQuery.data ?? []).length} {t("plans.materialsUnit")}
      </p>
    </button>
  );
}
