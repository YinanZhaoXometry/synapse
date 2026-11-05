/**
 * The 广场 section (FR-39 web half, epic P2-11 T3; delta decision 3): the
 * plans front door's second tab — every public plan, newest-first, as
 * SquarePlan cards (topic, goal snippet, node count + stage chips, created
 * date). The adopt (改编) button calls the authenticated forkSquarePlan with
 * a client-minted uuid (AD-12), toasts 「已改编到你的计划」 and navigates to
 * the forked plan's home — the normal plan flow takes over; the card body
 * itself opens the addressable /square/:planId preview. Real data only — no
 * demo seeding (the empty state names the publish path instead). Failures
 * map the closed api enum through apiErrorKeys("square.") into sonner (AD-9).
 */
import { Link, useNavigate } from "react-router-dom";
import { GitFork } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { apiErrorCode, apiErrorKeys, newClientUuid, useForkSquarePlanMutation, useSquarePlansQuery } from "@/api";
import type { ErrorLike } from "@apollo/client";
import type { SquarePlanView } from "@/api/queries/square-queries";
import { stageGroups } from "./display-shaping";
import { localeTag } from "./locale";

/** The fork mutation's closed-enum → t() key map (one place, AD-9). */
const FORK_ERROR_KEYS: Record<string, string> = apiErrorKeys("square.");
const FORK_FAILED_KEY = "square.adoptFailed";

export default function SquareSection() {
  const { t } = useLanguage();
  const squareQuery = useSquarePlansQuery();
  if (squareQuery.loading) return null;
  const plans = squareQuery.data ?? [];

  return (
    <section className="mt-4" data-testid="square-section">
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-[1.6] mt-6 max-w-[520px]">{t("square.empty")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {plans.map((plan) => (
            <SquarePlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </section>
  );
}

/** One SquarePlan card (delta decision 3's list shape): a header link to the
    preview + the per-card 改编 adopt affordance beside it. */
export function SquarePlanCard({ plan }: { plan: SquarePlanView }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [forkPlan, forkResult] = useForkSquarePlanMutation();

  const adopt = async () => {
    try {
      const result = await forkPlan({ variables: { input: { sourcePlanId: plan.id, clientUuid: newClientUuid() } } });
      const newId = result.data?.forkSquarePlan?.plan.id;
      if (!newId) throw new Error("missing forked plan id");
      toast.success(t("square.adoptedToast"));
      navigate(`/plan/${newId}`);
    } catch (error) {
      const code = apiErrorCode(error as ErrorLike);
      toast.error(t(code ? (FORK_ERROR_KEYS[code] ?? FORK_FAILED_KEY) : FORK_FAILED_KEY));
    }
  };

  const stages = stageGroups(plan.nodeSummaries).map((group) => group.stage ?? t("plans.stageUntitled"));

  return (
    <div
      className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 flex flex-col gap-2"
      data-testid="square-plan-card"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/square/${plan.id}`}
          className="min-w-0 flex-1 cursor-pointer group"
          data-testid="square-card-link"
        >
          <p className="font-semibold text-sm truncate group-hover:text-accent-ink transition-colors">
            {plan.topic}
          </p>
          {plan.goal && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{plan.goal}</p>}
        </Link>
        <Button
          size="sm"
          variant="outline"
          className="flex-none"
          disabled={forkResult.loading}
          onClick={() => void adopt()}
          data-testid="square-card-adopt"
        >
          <GitFork className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> {t("square.adopt")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {plan.nodeSummaries.length} {t("plans.nodesUnit")}
        </span>
        {stages.map((stage, index) => (
          <span key={`${stage}-${index}`} className="pill pill-muted">
            {stage}
          </span>
        ))}
        <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
          {new Date(plan.createdAt).toLocaleDateString(localeTag(language))}
        </span>
      </div>
    </div>
  );
}
