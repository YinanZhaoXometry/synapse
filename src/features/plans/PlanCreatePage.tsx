import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CreationChat from "./CreationChat";

/**
 * Plan creation route (AD-8; FR-1): the same creation chat the Plans-Home empty
 * state hosts, reachable any time via create-new. Confirming navigates to the
 * new plan's Plan Home.
 */
export default function PlanCreatePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/plans")}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {t("plans.backToPlans")}
      </button>
      <p className="eyebrow mt-2">{t("plans.eyebrow")}</p>
      <h1 className="page-title mt-1.5">{t("plans.createTitle")}</h1>
      <CreationChat />
    </div>
  );
}
