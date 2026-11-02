import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Plan Home light (AD-8) — honest shell for ticket 01; the mastery rollup,
 * stage-grouped nodes, materials and quick actions land in ticket 03.
 */
export default function PlanHomePage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <h1 className="page-title">{t("plans.planTitle")}</h1>
    </div>
  );
}
