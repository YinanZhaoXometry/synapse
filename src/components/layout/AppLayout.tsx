import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Settings, Globe, Search
} from "lucide-react";
import { useState } from "react";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { navGroups, flatNav, mobileNavPaths } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const mobileNav = mobileNavPaths
  .map(to => flatNav.find(item => item.to === to))
  .filter((item): item is (typeof flatNav)[number] => Boolean(item));

export default function AppLayout() {
  const { progress } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);

  const renderLink = (item: (typeof flatNav)[number]) => {
    const isActive = location.pathname === item.to;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-white/90 text-foreground shadow-soft"
            : "text-sidebar-foreground/70 hover:text-foreground hover:bg-white/60"
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
      <aside className="hidden lg:flex w-64 flex-col glass-panel border-r">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="w-8 h-8 rounded-[9px] bg-gradient-hero shadow-brand flex items-center justify-center shrink-0">
            <img src="/favicon.png" alt="Synapse" className="w-5 h-5" />
          </span>
          <span className="font-display font-bold text-base tracking-tight text-foreground">Synapse</span>
        </div>

        {/* Language Toggle */}
        <div className="px-3 pt-1 pb-1">
          <button
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === "zh" ? "English" : "中文"}
          </button>
        </div>

        {/* Command-bar search pill (Northstar ⌘K) */}
        <div className="px-3 pt-2">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 rounded-lg bg-white/70 border border-border px-3 py-2 text-sm text-muted-foreground text-left hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">{t("nav.search")}</span>
            <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.labelKey ?? "settings"}>
              {group.labelKey && (
                <p className="px-3 pb-1 text-[10px] font-body font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {t(group.labelKey)}
                </p>
              )}
              <div className="space-y-0.5">{group.items.map(renderLink)}</div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-3 pt-2 border-t border-white/60">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-hero shadow-brand flex items-center justify-center font-display font-semibold text-white text-sm">
              {language === "zh" ? "学" : "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t("common.student")}</p>
              <p className="text-xs text-muted-foreground">{t("common.level")} {progress.level} · {progress.points} {t("common.points")}</p>
            </div>
            <NavLink to="/settings" aria-label={t("nav.settings")} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/60 transition-colors">
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Icon rail (md–lg) */}
      <aside className="hidden md:flex lg:hidden w-16 flex-col items-center glass-panel border-r">
        <div className="flex items-center justify-center py-4 w-full">
          <span className="w-8 h-8 rounded-[9px] bg-gradient-hero shadow-brand flex items-center justify-center">
            <img src="/favicon.png" alt="Synapse" className="w-5 h-5" />
          </span>
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
                        ? "bg-white/90 text-primary shadow-soft"
                        : "text-sidebar-foreground/70 hover:text-foreground hover:bg-white/60"
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
        <div className="w-full p-3 border-t border-white/60 flex flex-col items-center gap-2">
          <button
            onClick={() => setCmdOpen(true)}
            aria-label={t("nav.search")}
            className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/60 transition-all"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
            className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/60 transition-all"
          >
            <Globe className="w-4 h-4" />
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/settings"
                aria-label={t("nav.settings")}
                className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/60 transition-all"
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
        <header className="md:hidden flex items-center justify-between px-4 py-3 glass-panel border-b">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[8px] bg-gradient-hero shadow-brand flex items-center justify-center">
              <img src="/favicon.png" alt="Synapse" className="w-4 h-4" />
            </span>
            <span className="font-display font-bold text-base">Synapse</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCmdOpen(true)}
              aria-label={t("nav.search")}
              className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-white/60 transition-all"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
              aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-white/60 transition-all"
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
        <nav className="md:hidden flex items-center justify-around glass-panel border-t py-2 px-1">
          {mobileNav.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px] transition-all",
                  isActive ? "text-primary bg-white/70 shadow-soft" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
