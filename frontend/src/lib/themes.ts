// Theme palette ported from the northstar-reference design (OpenDesign "UI Redesign Plan",
// northstar-reference.html THEMES block). Sunset is the brand default and matches the
// existing tokens exactly (accent #ff5f5f, gradient #ff7e5f → #feb47b).
export type ThemeId = "sunset" | "twilight" | "aurora";
export type ThemeMode = "system" | "light" | "dark";

export interface ThemeDef {
  id: ThemeId;
  labelKey: string;
  accent: string;
  gradA: string;
  gradB: string;
  /** Deep ink used for text sitting on accent tints (light mode). */
  ink: string;
}

export const THEMES: ThemeDef[] = [
  { id: "sunset", labelKey: "theme.sunset", accent: "#ff5f5f", gradA: "#ff7e5f", gradB: "#feb47b", ink: "#b23a3a" },
  { id: "twilight", labelKey: "theme.twilight", accent: "#7f5af0", gradA: "#7f5af0", gradB: "#e84393", ink: "#593fa8" },
  { id: "aurora", labelKey: "theme.aurora", accent: "#0d9e8a", gradA: "#16d2a8", gradB: "#0db4f7", ink: "#096f61" },
];

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find(th => th.id === id) ?? THEMES[0];
}

/** "#rrggbb" → "H S% L%" triplet, the shape our HSL token vars expect. */
export function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function channelToHex(v: number): string {
  const clamped = Math.round(Math.min(255, Math.max(0, v)));
  return clamped.toString(16).padStart(2, "0");
}

/** Mix a hex color toward white by ratio (0–1). Design dark mode uses this for accent/ink lifts. */
export function mixWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => c * (1 - ratio) + 255 * ratio;
  return `#${channelToHex(mix(r))}${channelToHex(mix(g))}${channelToHex(mix(b))}`;
}

/** Turn an 8-digit rgba string of a hex + alpha — used for the tint/ring/edge token vars. */
export function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
