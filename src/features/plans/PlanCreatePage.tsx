import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Plan creation route (AD-8) — honest shell for ticket 01;
 * the plan-structure chat lands in ticket 02.
 */
export default function PlanCreatePage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <h1 className="page-title">{t("plans.createTitle")}</h1>
    </div>
  );
}
