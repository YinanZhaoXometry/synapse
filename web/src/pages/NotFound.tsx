import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="empty-state" style={{ marginTop: 48 }}>
        <b>{t("common.notFoundTitle")}</b>
        <span>{t("common.notFoundBody")}</span>
        <div className="mt-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-hero text-white shadow-brand text-sm font-medium hover:shadow-brand-hover hover:brightness-[1.03] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t("common.goDashboard")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
