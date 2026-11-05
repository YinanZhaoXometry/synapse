/**
 * One plan's visibility control (FR-38, epic P2-11 T1): the state chip
 * (私密 / 公开 — the server column, never recomputed, AD-14 posture) plus
 * the flip affordance. The popover is the CONFIRM step: it names the
 * STRUCTURE-ONLY contract before the flip lands (公开后仅共享计划结构……),
 * and carries the flip action — the confirm gate lives in the UI because
 * the api command itself is idempotent and deliberately plain. The mutation
 * rides setPlanVisibility with the Plan read-back sweep, so the chip flips
 * from server truth, never optimism (the MaterialScopeControls precedent);
 * failures map the closed api enum through apiErrorKeys("visibility.")
 * into sonner (AD-9). Semantic tokens only — reads in both themes.
 */
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiErrorCode, apiErrorKeys, useSetPlanVisibilityMutation } from "@/api";
import type { StudyPlanView } from "@/api/views";
import type { ErrorLike } from "@apollo/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/** The visibility mutation's closed-enum → t() key map (one place, AD-9). */
const VISIBILITY_ERROR_KEYS: Record<string, string> = apiErrorKeys("visibility.");
const VISIBILITY_FAILED_KEY = "visibility.failed";

export default function PlanVisibilityControls({ plan }: { plan: StudyPlanView }) {
  const { t } = useLanguage();
  const [setVisibility, setVisibilityResult] = useSetPlanVisibilityMutation();
  const isPublic = plan.visibility === "public";

  const failureToast = (error: ErrorLike | undefined) => {
    const code = apiErrorCode(error);
    toast.error(t(code ? (VISIBILITY_ERROR_KEYS[code] ?? VISIBILITY_FAILED_KEY) : VISIBILITY_FAILED_KEY));
  };

  const flip = async () => {
    const next = isPublic ? "private" : "public";
    try {
      await setVisibility({ variables: { input: { planId: plan.id, visibility: next } } });
      toast.success(t(next === "public" ? "visibility.publicToast" : "visibility.privateToast"));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5" data-testid="plan-visibility-controls">
      <span
        className={cn("pill cursor-help flex-none", isPublic ? "pill-partial" : "pill-muted")}
        data-testid="visibility-chip"
        title={isPublic ? t("visibility.publicHint") : t("visibility.privateHint")}
      >
        {isPublic ? t("visibility.chipPublic") : t("visibility.chipPrivate")}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="visibility-action"
            disabled={setVisibilityResult.loading}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {t("visibility.action")}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start" data-testid="visibility-popover">
          <p className="text-xs font-semibold">{t("visibility.title")}</p>
          {/* The STRUCTURE-ONLY disclosure — the whole point of FR-38's confirm step. */}
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-[1.5]" data-testid="visibility-disclosure">
            {t("visibility.disclosure")}
          </p>
          <Button
            size="sm"
            variant={isPublic ? "outline" : "default"}
            onClick={() => void flip()}
            disabled={setVisibilityResult.loading}
            data-testid="visibility-confirm"
            className="mt-2.5 w-full cursor-pointer"
          >
            {isPublic ? t("visibility.makePrivate") : t("visibility.makePublic")}
          </Button>
        </PopoverContent>
      </Popover>
    </span>
  );
}
