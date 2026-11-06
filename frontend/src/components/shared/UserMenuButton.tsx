import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { logout } from "@/apollo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SETTINGS_ROUTE } from "@/components/layout/nav-items";

/**
 * The user-footer account menu (2026-11-06 logout fix): sign-out used to live
 * only on the Settings page's account card and nobody found it, so the avatar
 * in every sidebar surface (desktop footer, tablet icon rail, mobile drawer)
 * now opens this popover — 设置 navigates, 退出登录 cuts the session through
 * the ONE logout seam (clearToken + resetApiClient, AD-15) and lands on the
 * login wall, the exact contract the Settings-page button pins.
 */
export default function UserMenuButton({
  compact = false,
  onAction,
}: {
  /** Tablet-rail placement: the popover opens to the side instead of above. */
  compact?: boolean;
  /** Fired before the item action runs (the mobile drawer closes itself). */
  onAction?: () => void;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    onAction?.();
  };

  const signOut = () => {
    close();
    void logout().then(() => window.location.replace("/login"));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.userMenu")}
          title={t("nav.userMenu")}
          className="w-9 h-9 shrink-0 rounded-full bg-[var(--accent-tint)] flex items-center justify-center font-semibold text-accent-ink text-[13px] cursor-pointer transition-transform hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {language === "zh" ? "学" : "S"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={compact ? "right" : "top"}
        align="start"
        sideOffset={8}
        className="w-44 rounded-xl border border-border bg-card p-1.5 shadow-hover"
      >
        <NavLink
          to={SETTINGS_ROUTE.to}
          onClick={close}
          className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-[var(--glass-2)] hover:text-foreground"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t("nav.settings")}
        </NavLink>
        <button
          type="button"
          onClick={signOut}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t("settings.logout")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
