import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { THEMES, getTheme, hexToHslTriplet, mixWhite, hexAlpha, type ThemeId, type ThemeMode } from "@/lib/themes";

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  reduceMotion: boolean;
  setReduceMotion: (on: boolean) => void;
  /** Effective dark state — "system" resolves against prefers-color-scheme. */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const PREFERS_DARK = window.matchMedia?.("(prefers-color-scheme: dark)");

function readStored<T extends string>(key: string, allowed: T[], fallback: T): T {
  const saved = localStorage.getItem(key);
  return allowed.includes(saved as T) ? (saved as T) : fallback;
}

// Theme system ported from northstar-reference.html (applySettings): the palette drives
// the accent/gradient/ink/tint CSS vars at runtime, mode drives the `dark` class.
// Persistence follows the synapse-lang pattern (one localStorage key per setting).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeId] = useState<ThemeId>(() =>
    readStored("synapse-theme", THEMES.map(th => th.id), "sunset"),
  );
  const [mode, setModeId] = useState<ThemeMode>(() =>
    readStored("synapse-mode", ["system", "light", "dark"], "system"),
  );
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => localStorage.getItem("synapse-motion") === "off");
  const [systemDark, setSystemDark] = useState<boolean>(() => Boolean(PREFERS_DARK?.matches));

  const isDark = mode === "dark" ? true : mode === "light" ? false : systemDark;

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem("synapse-theme", id);
  };
  const setMode = (m: ThemeMode) => {
    setModeId(m);
    localStorage.setItem("synapse-mode", m);
  };
  const setReduceMotion = (on: boolean) => {
    setReduceMotionState(on);
    localStorage.setItem("synapse-motion", on ? "off" : "on");
  };

  useEffect(() => {
    const query = PREFERS_DARK;
    if (!query?.addEventListener) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const th = getTheme(theme);
    const root = document.documentElement;
    // Design: dark accents/inks are lifted with white (color-mix white 14% / 30%).
    const accent = isDark ? mixWhite(th.accent, 0.14) : th.accent;
    const accentHsl = hexToHslTriplet(accent);
    root.style.setProperty("--primary", accentHsl);
    root.style.setProperty("--accent", accentHsl);
    root.style.setProperty("--ring", accentHsl);
    root.style.setProperty("--sidebar-primary", accentHsl);
    root.style.setProperty("--sidebar-ring", accentHsl);
    root.style.setProperty("--chart-accent", accentHsl);
    root.style.setProperty("--grad-a", hexToHslTriplet(th.gradA));
    root.style.setProperty("--grad-b", hexToHslTriplet(th.gradB));
    root.style.setProperty("--accent-ink", isDark ? mixWhite(th.accent, 0.3) : th.ink);
    root.style.setProperty("--accent-tint", hexAlpha(th.accent, 0.1));
    root.style.setProperty("--accent-tint-2", hexAlpha(th.accent, 0.16));
    root.style.setProperty("--accent-ring", hexAlpha(th.accent, 0.22));
    root.style.setProperty("--accent-edge", hexAlpha(th.accent, 0.35));
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    root.classList.toggle("reduce-motion", reduceMotion);
  }, [theme, isDark, reduceMotion]);

  const value = useMemo(
    () => ({ theme, setTheme, mode, setMode, reduceMotion, setReduceMotion, isDark }),
    [theme, mode, reduceMotion, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
