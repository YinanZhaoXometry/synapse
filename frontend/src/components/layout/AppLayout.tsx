import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Settings, Search, Flame, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStreakQuery } from "@/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/shared/CommandPalette";
import UserMenuButton from "@/components/shared/UserMenuButton";
import { recordNavPathname } from "@/lib/nav-history";
import { NAV_GROUPS, NAV_ROUTES, SETTINGS_ROUTE, flatNav, mobileNavPaths } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const mobileNav = mobileNavPaths
  .map(to => flatNav.find(item => item.to === to))
  .filter((item): item is (typeof flatNav)[number] => Boolean(item));

export default function AppLayout() {
  const { t } = useLanguage();
  // The SERVER streak (AD-14) drives the mobile header's pill; the pill only
  // renders once the read lands (no 0-flash — honest-empty). The demo
  // progress context's level/points footer line retired with the context's
  // deletion (epic P2-09 T6): nothing real exists on the wire, so the footer
  // keeps just the avatar (the account-menu trigger — sign-out used to live
  // only on the Settings page and nobody found it) + name + settings gear.
  const streakQuery = useStreakQuery();
  const location = useLocation();
  // One-deep origin recorder (nav-history): spine-owned surfaces derive their
  // source-aware back from this. Render-body call on purpose — a route's first
  // render must already see the route it came from (an effect would run after
  // the children rendered). Same-path calls dedupe inside the recorder.
  recordNavPathname(location.pathname);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Prototype: Escape closes the mobile drawer (body.side-open).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const renderLink = (item: (typeof NAV_ROUTES)[number], onClick?: () => void) => {
    const isActive = location.pathname === item.to;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onClick}
        title={t(item.labelKey)}
        aria-label={t(item.labelKey)}
        className={cn(
          // Prototype .nav-item = 40px tall (padding 9px 10px + 14px/22px text)
          "group flex h-10 items-center gap-2.5 px-2.5 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-[var(--glass-4)] text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)]"
        )}
      >
        <item.icon
          className={cn(
            "w-[18px] h-[18px] shrink-0 transition-colors",
            isActive ? "text-accent-ink" : "text-caption-soft group-hover:text-muted-foreground"
          )}
        />
        {t(item.labelKey)}
      </NavLink>
    );
  };

  const searchPill = (
    <button
      onClick={() => setCmdOpen(true)}
      className="w-full flex items-center gap-2 rounded-lg bg-[var(--glass-4)] border border-border-soft px-2.5 py-2 text-sm text-muted-foreground text-left hover:bg-[var(--glass-solid)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Search className="w-4 h-4 shrink-0 text-caption" />
      <span className="flex-1 truncate">{t("nav.search")}</span>
      <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground">⌘K</kbd>
    </button>
  );

  // No bg on this shell — body carries the cream canvas + 3 radial gradient blobs
  // (prototype .app is transparent; the sidebar is frosted glass over them).
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Full sidebar (lg+) */}
      <aside className="hidden lg:flex w-[264px] flex-col gap-2 glass-panel border-r px-3 pt-3.5 pb-3" aria-label={t("common.navAria")}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5 border-b border-border-soft">
          <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-hero shadow-brand flex items-center justify-center shrink-0">
            <img src="/favicon.png" alt="" aria-hidden="true" className="w-[17px] h-[17px]" />
          </span>
          <span className="flex flex-col leading-tight min-w-0">
            <span className="font-display font-semibold text-xl tracking-tight text-foreground">Synapse</span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-caption mt-0.5">{t("brand.sub")}</span>
          </span>
        </div>

        {/* Command-bar search pill (Northstar ⌘K) */}
        <div className="pt-1">{searchPill}</div>

        {/* Grouped nav (scaffold navGroups restored — owner round 2026-11-02) */}
        <nav className="flex-1 pt-1 pb-2 overflow-y-auto" aria-label={t("common.primaryAria")}>
          {NAV_GROUPS.map(group => (
            <div key={group.labelKey} className="pt-2">
              <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-caption">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => renderLink(item))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer (prototype sidebar-foot) — language switch lives on the Settings page, so no lang toggle in the sidebar */}
        <div className="px-1 pt-2.5 border-t border-border-soft">
          <div className="flex items-center gap-2.5">
            <UserMenuButton />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight">Yinan Chen</p>
            </div>
            <NavLink to={SETTINGS_ROUTE.to} aria-label={t("nav.settings")} title={t("nav.settings")} className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-caption hover:bg-[var(--glass-3)] hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Icon rail (md–lg) */}
      <aside className="hidden md:flex lg:hidden w-16 flex-col items-center glass-panel border-r">
        <div className="flex items-center justify-center py-4 w-full border-b border-border-soft">
          <span className="w-8 h-8 rounded-[9px] bg-gradient-hero shadow-brand flex items-center justify-center">
            <img src="/favicon.png" alt="" aria-hidden="true" className="w-4 h-4" />
          </span>
        </div>
        <nav className="flex-1 w-full px-2 py-3 space-y-1 overflow-y-auto" aria-label={t("common.primaryAria")}>
          {NAV_ROUTES.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    aria-label={t(item.labelKey)}
                    title={t(item.labelKey)}
                    className={cn(
                      // Prototype tablet .nav-item: padding 11px 0 + 18px icon = 40px tall
                      "flex items-center justify-center w-full py-[11px] rounded-lg transition-all duration-150",
                      isActive
                        ? "bg-[var(--glass-4)] text-accent-ink shadow-soft"
                        : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)]"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <div className="w-full p-2 border-t border-border-soft flex flex-col items-center gap-1.5">
          <button
            onClick={() => setCmdOpen(true)}
            aria-label={t("nav.search")}
            className="flex items-center justify-center w-full py-2 rounded-lg text-caption hover:text-foreground hover:bg-[var(--glass-3)] transition-all"
          >
            <Search className="w-4 h-4" />
          </button>
          {/* Tablet sidebar-foot avatar = the account-menu trigger */}
          <UserMenuButton compact />
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={SETTINGS_ROUTE.to}
                aria-label={t(SETTINGS_ROUTE.labelKey)}
                className="flex items-center justify-center w-full py-2 rounded-lg text-caption hover:text-foreground hover:bg-[var(--glass-3)] transition-all"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t(SETTINGS_ROUTE.labelKey)}</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile header + main + bottom nav */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-3 h-14 glass-mobile-bar border-b">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("nav.menu")}
              aria-expanded={drawerOpen}
              className="text-caption hover:text-foreground p-1.5 -ml-1.5 rounded-md hover:bg-[var(--glass-3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="w-7 h-7 rounded-[9px] bg-gradient-hero shadow-brand flex items-center justify-center">
              <img src="/favicon.png" alt="" aria-hidden="true" className="w-3.5 h-3.5" />
            </span>
            <span className="font-display font-semibold text-[17px]">Synapse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCmdOpen(true)}
              aria-label={t("nav.search")}
              className="text-caption hover:text-foreground px-1.5 py-1 rounded-md hover:bg-[var(--glass-3)] transition-all"
            >
              <Search className="w-4 h-4" />
            </button>
            {streakQuery.data !== undefined && (
              <span className="pill pill-streak" title={`${t("dashboard.streak", { n: streakQuery.data })} · ${t("dashboard.streakRule")}`}>
                <Flame aria-hidden="true" />
                <span>{t("dashboard.streak", { n: streakQuery.data })}</span>
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        <nav className="md:hidden flex items-center justify-around glass-bottom-nav border-t py-1.5 px-2" aria-label={t("common.primaryAria")}>
          {mobileNav.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-[3px] flex-1 min-h-12 rounded-[10px] text-[9px] font-semibold transition-all",
                  isActive ? "text-accent-ink bg-[var(--accent-tint)]" : "text-caption"
                )}
              >
                <item.icon className="w-[19px] h-[19px]" />
                {t(item.labelKey)}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Mobile drawer (prototype body.side-open): off-canvas sidebar + scrim */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-[rgba(26,20,18,0.32)] animate-fade-in"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      {drawerOpen && (
        <aside
          className="md:hidden fixed inset-y-0 left-0 z-50 w-[min(290px,84vw)] flex flex-col gap-2 glass-panel shadow-hover px-3 pt-3.5 pb-3 animate-in slide-in-from-left duration-300"
          role="dialog"
          aria-modal="true"
          aria-label={t("common.navAria")}
        >
          <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5 border-b border-border-soft">
            <span className="w-[34px] h-[34px] rounded-[11px] bg-gradient-hero shadow-brand flex items-center justify-center shrink-0">
              <img src="/favicon.png" alt="" aria-hidden="true" className="w-[17px] h-[17px]" />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-display font-semibold text-xl tracking-tight text-foreground">Synapse</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-caption mt-0.5">{t("brand.sub")}</span>
            </span>
          </div>

          <div className="pt-1" onClick={() => setDrawerOpen(false)}>
            {searchPill}
          </div>

          <nav className="flex-1 pt-1 pb-2 overflow-y-auto" aria-label={t("common.primaryAria")}>
            {NAV_GROUPS.map(group => (
              <div key={group.labelKey} className="pt-2">
                <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-caption">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => renderLink(item, () => setDrawerOpen(false)))}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-1 pt-2.5 border-t border-border-soft" onClick={() => setDrawerOpen(false)}>
            <div className="flex items-center gap-2.5">
              <UserMenuButton onAction={() => setDrawerOpen(false)} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate leading-tight">Yinan Chen</p>
              </div>
              <NavLink to={SETTINGS_ROUTE.to} aria-label={t("nav.settings")} title={t("nav.settings")} className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-caption hover:bg-[var(--glass-3)] hover:text-foreground transition-colors">
                <Settings className="w-4 h-4" />
              </NavLink>
            </div>
          </div>
        </aside>
      )}

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
