/**
 * AI Tutor (FR-46, epic P2-12 T3 — the /ai-tutor re-point, delta decision 2):
 * the retained destination inherits the plan-level Companion — a thin
 * plan-picker over CompanionPanel in plan-grounding mode. The Phase-1 demo
 * keyword-response engine and its fixture replies RETIRED with this ticket
 * (the delta-grill's explicit ruling: kept alive one ticket longer would mean
 * maintaining a fake) — every answer now streams from the real plan grounding
 * (plan scope + confirmed mappings + the mistake-entry input), cited.
 *
 * No plans → the honest empty state: the tutor answers from your materials,
 * so it needs a plan with attached materials first. The nav entry stays
 * (the retained ten); the page is its real surface now.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CompanionPanel } from "@/features/companion";
import { usePlanMaterialsQuery, usePlanMistakeEntriesQuery, usePlansQuery } from "@/api";

export default function AITutorPage() {
  const { t } = useLanguage();
  const plansQuery = usePlansQuery();
  // The picker defaults to the first plan (the front-door plan-first order);
  // the user's pick rides the drawer below.
  const [planId, setPlanId] = useState("");
  const plans = plansQuery.data ?? [];

  useEffect(() => {
    const first = plansQuery.data?.[0];
    if (!planId && first) setPlanId(first.id);
  }, [planId, plansQuery.data]);

  const materialsQuery = usePlanMaterialsQuery(planId);
  const mistakesQuery = usePlanMistakeEntriesQuery(planId);

  return (
    <div className="flex flex-col h-full w-full max-w-[900px] mx-auto px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border-soft shrink-0">
        <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-gradient-hero shadow-brand grid place-items-center text-white shrink-0">
          <Sparkles className="w-[19px] h-[19px]" />
        </span>
        <div>
          <div className="font-body text-lg font-semibold tracking-[-0.01em]">{t("tutor.title")}</div>
          <div className="text-xs text-caption mt-0.5">{t("tutor.subtitle")}</div>
        </div>
      </div>

      {plansQuery.loading ? null : plans.length === 0 ? (
        // The honest empty state: no plan, no materials to ground on — the
        // tutor never fake-answers (the retired demo engine's lesson).
        <div className="flex-1 min-h-0 grid place-items-center py-10">
          <div className="max-w-sm text-center border border-dashed border-border rounded-2xl px-6 py-8 bg-secondary/50">
            <Sparkles className="w-6 h-6 mx-auto text-accent-ink" aria-hidden="true" />
            <p className="text-sm font-semibold mt-3">{t("tutor.noPlansTitle")}</p>
            <p className="text-xs text-muted-foreground leading-[1.6] mt-2">{t("tutor.noPlans")}</p>
            <Link
              to="/plans"
              className="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-xs font-semibold hover:shadow-brand-hover transition-all"
            >
              {t("tutor.noPlansCta")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* the plan picker — which plan's materials the tutor grounds on */}
          <label className="flex items-center gap-2 pt-4 pb-3 shrink-0 text-xs text-muted-foreground">
            {t("tutor.planLabel")}
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {plans.length === 0 && <option value="">{t("tutor.planLabel")}</option>}
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.topic}
                </option>
              ))}
            </select>
          </label>

          {planId ? (
            <div className="flex-1 min-h-0 rounded-2xl border border-border-soft bg-card shadow-raised overflow-hidden">
              <CompanionPanel
                mode="plan"
                planId={planId}
                materials={materialsQuery.data ?? []}
                mistakeEntries={mistakesQuery.data ?? []}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
