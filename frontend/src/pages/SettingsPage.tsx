import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useTheme } from "@/contexts/ThemeContext";
import { clearToken, logout, resetApiClient } from "@/apollo";
import { THEMES, type ThemeId, type ThemeMode } from "@/lib/themes";
import { fmtNum } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const PRIMARY_CTA =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2.5 text-sm font-semibold transition-all " +
  "hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

const DANGER_BTN =
  "inline-flex items-center rounded-[10px] bg-card px-3 py-[7px] text-xs font-semibold text-danger-ink shadow-[inset_0_0_0_1px_rgba(168,50,50,0.22)] transition-colors " +
  "hover:bg-[rgba(168,50,50,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

const MODE_OPTIONS: ThemeMode[] = ["system", "light", "dark"];
const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  system: "settings.modeSystem",
  light: "settings.modeLight",
  dark: "settings.modeDark",
};

// Layout ported from northstar-reference.html settingsView: stacked .settings-group
// cards with uppercase headers and full-width setting rows (label/help left, control right).
export default function SettingsPage() {
  const { progress, resetAll } = useUserProgress();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, mode, setMode, reduceMotion, setReduceMotion } = useTheme();

  const langCards: Array<{ lang: "zh" | "en"; labelKey: string; descKey: string }> = [
    { lang: "zh", labelKey: "settings.langZh", descKey: "settings.langZhDesc" },
    { lang: "en", labelKey: "settings.langEn", descKey: "settings.langEnDesc" },
  ];

  return (
    <div className="max-w-[984px] mx-auto px-6 py-8">
      {/* Page head */}
      <div>
        <p className="eyebrow">{t("settings.eyebrow")}</p>
        <h1 className="page-title mt-1.5">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{t("settings.subtitle")}</p>
      </div>

      {/* Group 1 — profile + language */}
      <section className="settings-group">
        <h2>{t("settings.profile")}</h2>
        <div className="setting-row">
          <span
            aria-hidden="true"
            className="w-[46px] h-[46px] rounded-full bg-[var(--accent-tint)] grid place-items-center text-accent-ink font-semibold text-[15px] shrink-0"
          >
            {language === "zh" ? "学" : "S"}
          </span>
          <div className="min-w-0">
            <div className="text-base font-semibold">Yinan Chen</div>
            <div className="text-[10px] text-caption mt-0.5">
              {t("settings.profileMeta", { level: progress.level, points: fmtNum(progress.points) })}
            </div>
          </div>
        </div>
        <p className="setting-note px-6 pb-3">{t("settings.profileNote")}</p>

        <div className="setting-row">
          <div className="min-w-0">
            <div className="setting-label">{t("settings.language")}</div>
            <div className="setting-help mt-0.5">{t("settings.languageNote")}</div>
          </div>
        </div>
        <div className="setting-row">
          <div className="grid grid-cols-2 gap-2 w-full">
            {langCards.map(card => {
              const active = language === card.lang;
              return (
                <button
                  key={card.lang}
                  type="button"
                  onClick={() => setLanguage(card.lang)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border bg-card p-3.5 text-left transition-all",
                    "hover:border-[color:var(--accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary shadow-[0_0_0_3px_var(--accent-ring)]"
                      : "border-border"
                  )}
                >
                  <b className="block text-[13px] font-semibold">{t(card.labelKey)}</b>
                  <span className="block text-[10px] text-caption mt-0.5 leading-snug">{t(card.descKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Group 2 — appearance: mode + theme + motion (northstar appearance group) */}
      <section className="settings-group">
        <h2>{t("settings.appearance")}</h2>
        <p className="group-note">{t("settings.appearanceNote")}</p>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.mode")}</div>
            <div className="setting-help mt-0.5">{t("settings.modeHelp")}</div>
          </div>
          <div className="relative shrink-0">
            <select
              value={mode}
              onChange={e => setMode(e.target.value as ThemeMode)}
              aria-label={t("settings.mode")}
              className="appearance-none rounded-xl border border-border bg-[var(--glass-4)] py-2 pl-3 pr-8 text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MODE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {t(MODE_LABEL_KEYS[opt])}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-caption"
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.theme")}</div>
            <div className="setting-help mt-0.5">{t("settings.themeHelp")}</div>
          </div>
          <div className="theme-swatches shrink-0" role="group" aria-label={t("settings.theme")}>
            {THEMES.map(th => (
              <button
                key={th.id}
                type="button"
                className="swatch"
                style={{ background: `linear-gradient(135deg, ${th.gradA}, ${th.gradB})` }}
                aria-pressed={theme === (th.id as ThemeId)}
                aria-label={t(th.labelKey)}
                title={t(th.labelKey)}
                onClick={() => setTheme(th.id)}
              />
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.reduceMotion")}</div>
            <div className="setting-help mt-0.5">{t("settings.reduceMotionHelp")}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reduceMotion}
            aria-label={t("settings.reduceMotion")}
            onClick={() => setReduceMotion(!reduceMotion)}
            className="switch shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </section>

      {/* Group 3 — data + keyboard */}
      <section className="settings-group">
        <h2>{t("settings.general")}</h2>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.logout")}</div>
            <div className="setting-help mt-0.5">{t("settings.logoutNote")}</div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-[10px] bg-card px-3 py-[7px] text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-colors hover:bg-[var(--glass-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] cursor-pointer"
            onClick={() => {
              // AD-15 client-side logout (ticket 02): token + cache + live
              // streams die here; preferences stay (that is reset's job).
              void logout().then(() => window.location.replace("/login"));
            }}
          >
            {t("settings.logout")}
          </button>
        </div>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.data")}</div>
            <div className="setting-help mt-0.5">{t("settings.dataNote")}</div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className={cn(DANGER_BTN, "shrink-0")}>
                {t("settings.reset")}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">{t("settings.resetTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.resetBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  className="rounded-xl bg-[var(--glass-4)] border border-border text-sm font-semibold hover:bg-[var(--glass-solid)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                >
                  {t("common.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={PRIMARY_CTA}
                  onClick={() => {
                    // Cutover semantics (epic P2-8 T1): study data lives on the
                    // server and is NEVER deleted client-side — reset clears
                    // this device's UI prefs and signs out (token + Apollo
                    // cache wiped so no trace of the account renders — FR-4).
                    // Server-side account surfaces arrive with epic-14.
                    for (const key of ["synapse-lang", "synapse-theme", "synapse-mode", "synapse-motion"]) {
                      try {
                        localStorage.removeItem(key);
                      } catch {
                        // storage unavailable — prefs reset is best-effort
                      }
                    }
                    clearToken();
                    void resetApiClient();
                    resetAll();
                    toast(t("common.resetDone"));
                    // Fresh reload into the signed-out entry state: `/` re-runs
                    // the entry gate with the client caches reborn empty.
                    window.location.replace("/");
                  }}
                >
                  {t("common.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="setting-row">
          <div className="flex-1 min-w-0">
            <div className="setting-label">{t("settings.keyboard")}</div>
            <div className="setting-help mt-0.5">{t("settings.keyboardNote")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
