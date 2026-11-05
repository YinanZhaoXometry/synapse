/**
 * Square Plan preview (FR-39 web half, epic P2-11 T3; delta decision 3): the
 * addressable /square/:planId route behind every 广场 card. Renders the
 * public plan's STRUCTURE ONLY — topic/goal header + stage-ordered node
 * lists off squarePlan's reduced SquarePlanType set (there are no score or
 * content fields to read, NFR-7) — plus the adopt CTA. Adopting calls the
 * authenticated forkSquarePlan mutation with a client-minted uuid (AD-12),
 * toasts 「已改编到你的计划」, and hands the browser to the new plan's home
 * (/plan/:newId) — the normal plan flow takes over (attach materials etc.).
 * A vanished/vacated source (private flip, deletion — the preview-to-fork
 * race) answers the honest not-found copy, never a silent dead end.
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GitFork } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { apiErrorCode, apiErrorKeys, newClientUuid, useForkSquarePlanMutation, useSquarePlanQuery } from "@/api";
import type { ErrorLike } from "@apollo/client";
import { stageGroups } from "./display-shaping";
import { localeTag } from "./locale";

/** The fork mutation's closed-enum → t() key map (one place, AD-9). */
const FORK_ERROR_KEYS: Record<string, string> = apiErrorKeys("square.");
const FORK_FAILED_KEY = "square.adoptFailed";

export default function SquarePlanPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { planId } = useParams();
  const previewQuery = useSquarePlanQuery(planId ?? "");
  const [forkPlan, forkResult] = useForkSquarePlanMutation();

  const backLink = (
    <button
      type="button"
      onClick={() => navigate("/plans")}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {t("square.previewBack")}
    </button>
  );

  if (previewQuery.loading) return null;

  if (previewQuery.error || !previewQuery.data) {
    const code = apiErrorCode(previewQuery.error);
    return (
      <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
        {backLink}
        <p className="page-title mt-6 text-lg">
          {code ? t(FORK_ERROR_KEYS[code] ?? "square.previewNotFound") : t("square.previewNotFound")}
        </p>
      </div>
    );
  }

  const plan = previewQuery.data;
  const stages = stageGroups(plan.nodeSummaries);

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

  return (
    <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
      {backLink}
      <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
        <div className="min-w-0">
          <p className="eyebrow">{t("square.previewEyebrow")}</p>
          <h1 className="page-title mt-1.5">{plan.topic}</h1>
          {plan.goal && <p className="text-xs text-muted-foreground mt-1">{plan.goal}</p>}
          <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
            {new Date(plan.createdAt).toLocaleDateString(localeTag(language))}
          </p>
        </div>
        <Button onClick={() => void adopt()} disabled={forkResult.loading} data-testid="square-adopt-cta">
          <GitFork className="w-4 h-4 mr-1.5" aria-hidden="true" /> {t("square.adoptCta")}
        </Button>
      </div>

      {stages.map((group) => (
        <section key={JSON.stringify(group.stage)} className="mb-5 mt-4">
          <h2 className="eyebrow mb-2">{group.stage ?? t("plans.stageUntitled")}</h2>
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
            {group.rows.map((node, index) => (
              <div key={`${node.order}-${index}`} className="px-4 py-3 flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground tabular-nums w-6 flex-none">
                  {node.order}
                </span>
                <span className="text-sm truncate">{node.title}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
