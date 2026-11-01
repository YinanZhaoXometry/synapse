import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, MessageSquare, BookOpen, HelpCircle, 
  Brain, NotebookPen, CalendarDays, Trophy, BarChart3, 
  Settings, Globe 
} from "lucide-react";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const navKeys = [
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { to: "/ai-tutor", icon: MessageSquare, labelKey: "nav.aiTutor" },
  { to: "/materials", icon: BookOpen, labelKey: "nav.materials" },
  { to: "/quiz", icon: HelpCircle, labelKey: "nav.quiz" },
  { to: "/flashcards", icon: Brain, labelKey: "nav.flashcards" },
  { to: "/mistakes", icon: NotebookPen, labelKey: "nav.mistakes" },
  { to: "/planner", icon: CalendarDays, labelKey: "nav.planner" },
  { to: "/achievements", icon: Trophy, labelKey: "nav.achievements" },
  { to: "/analytics", icon: BarChart3, labelKey: "nav.analytics" },
];

export default function AppLayout() {
  const { progress } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <img src="/favicon.png" alt="Synapse" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-lg tracking-tight text-foreground">Synapse</span>
        </div>

        {/* Language Toggle */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === "zh" ? "English" : "中文"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navKeys.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-secondary"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px]", isActive && "text-primary")} />
                {t(item.labelKey)}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-display font-semibold text-primary text-sm">
              {language === "zh" ? "学" : "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t("common.student")}</p>
              <p className="text-xs text-muted-foreground">{t("common.level")} {progress.level} · {progress.points} {t("common.points")}</p>
            </div>
            <NavLink to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Synapse" className="w-7 h-7 rounded-lg" />
            <span className="font-display font-bold text-base">Synapse</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-all"
            >
              <Globe className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground">🔥 {progress.streak}</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center justify-around border-t border-border bg-card py-2 px-1">
          {[navKeys[0], navKeys[1], navKeys[3], navKeys[4], navKeys[7]].map(item => {
            if (!item) return null;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
