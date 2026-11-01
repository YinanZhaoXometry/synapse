import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel border rounded-2xl shadow-raised px-8 py-12 text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gradient-hero shadow-brand flex items-center justify-center mx-auto mb-5">
          <Compass className="w-7 h-7 text-white" aria-hidden="true" />
        </div>
        <p className="mastery-number text-3xl mb-1">404</p>
        <p className="mb-6 text-sm text-muted-foreground">{t("notFound.title")}</p>
        <a href="/" className="inline-flex items-center px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t("notFound.back")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
