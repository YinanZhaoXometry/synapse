import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, BookOpen, HelpCircle,
  Brain, NotebookPen, CalendarDays, Trophy, BarChart3,
  Settings, Globe
} from "lucide-react";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    labelKey: "nav.group.overview",
    items: [{ to: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" }],
  },
  {
    labelKey: "nav.group.learn",
    items: [
      { to: "/ai-tutor", icon: MessageSquare, labelKey: "nav.aiTutor" },
      { to: "/materials", icon: BookOpen, labelKey: "nav.materials" },
      { to: "/planner", icon: CalendarDays, labelKey: "nav.planner" },
    ],
  },
  {
    labelKey: "nav.group.practice",
    items: [
      { to: "/quiz", icon: HelpCircle, labelKey: "nav.quiz" },
      { to: "/flashcards", icon: Brain, labelKey: "nav.flashcards" },
      { to: "/mistakes", icon: NotebookPen, labelKey: "nav.mistakes" },
    ],
  },
  {
    labelKey: "nav.group.progress",
    items: [
      { to: "/achievements", icon: Trophy, labelKey: "nav.achievements" },
      { to: "/analytics", icon: BarChart3, labelKey: "nav.analytics" },
    ],
  },
];

const flatNav = navGroups.flatMap(g => g.items);
const mobileNav = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"]
  .map(to => flatNav.find(item => item.to === to))
  .filter((item): item is (typeof flatNav)[number] => Boolean(item));

export default function AppLayout() {
  const { progress } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();

  const renderLink = (item: (typeof flatNav)[number]) => {
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
        <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
        {t(item.labelKey)}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Full sidebar (lg+) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card">
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
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.labelKey}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">{group.items.map(renderLink)}</div>
            </div>
          ))}
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
            <NavLink to="/settings" aria-label={t("nav.settings")} className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Icon rail (md–lg) */}
      <aside className="hidden md:flex lg:hidden w-16 flex-col items-center border-r border-border bg-card">
        <div className="flex items-center justify-center py-4 border-b border-border w-full">
          <img src="/favicon.png" alt="Synapse" className="w-8 h-8 rounded-lg" />
        </div>
        <nav className="flex-1 w-full px-2 py-3 space-y-1 overflow-y-auto">
          {flatNav.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    aria-label={t(item.labelKey)}
                    className={cn(
                      "flex items-center justify-center w-full py-2.5 rounded-lg transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <div className="w-full p-3 border-t border-border flex flex-col items-center gap-2">
          <button
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
            className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <Globe className="w-4 h-4" />
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/settings"
                aria-label={t("nav.settings")}
                className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.settings")}</TooltipContent>
          </Tooltip>
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
              aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
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
          {mobileNav.map(item => {
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
