import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Plans Home (AD-8) — the front door after onboarding. Honest shell for
 * ticket 01; the creation chat / continue hero / plan list land in tickets 02–03.
 */
export default function PlansHomePage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 md:p-8 max-w-[984px] mx-auto">
      <h1 className="page-title">{t("plans.homeTitle")}</h1>
    </div>
  );
}
