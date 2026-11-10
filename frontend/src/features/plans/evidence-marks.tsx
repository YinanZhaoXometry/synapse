/**
 * The evidence marks, extracted (epic-28 T4): the list view's evidence
 * popover body and the roadmap sheet's evidence bar render THE SAME truth —
 * the mastery window's outcome marks (●◐✕, oldest → newest), the outcome
 * legend, and the honest empty line. Presentation over evidence, never a
 * score (ADR-0001 posture; the marks re-derive the window in display-shaping
 * so the popover and the number always agree).
 */
import { useLanguage } from "@/contexts/LanguageContext";
import type { Outcome } from "@/domain/entities";
import { OutcomeMark } from "./atoms";
import { OUTCOME_LABEL_KEY } from "./outcome-labels";

export default function EvidenceMarks({ outcomes, title }: { outcomes: Outcome[]; title?: string }) {
  const { t } = useLanguage();
  return (
    <div data-testid="evidence-marks">
      {title && <p className="font-semibold mb-2">{title}</p>}
      <div className="flex items-center gap-1.5 mb-2">
        {outcomes.length === 0 ? (
          <span className="text-muted-foreground" data-testid="evidence-marks-empty">
            {t("plans.noEvidence")}
          </span>
        ) : (
          outcomes.map((outcome, i) => <OutcomeMark key={`${outcome}-${i}`} outcome={outcome} />)
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
    </div>
  );
}
