/**
 * The reader's Markdown content theme preference (epic-24 T3): the ONLY
 * reader-content skin toggle — claudette (the MIT Typora theme port, scoped
 * to the markdown flow) or the default app look. Settings owns the switch;
 * MarkdownFlow wears the class.
 *
 * Storage follows the four UI keys' lazy-write convention (nothing persists
 * on first load — the key exists only after the user enables the theme once;
 * disabling removes it, so OFF is the absent key, not a stored "default").
 * Live application: the hook subscribes to the module's change event plus the
 * storage event, so flipping the toggle re-skins an already-open reader.
 */
import { useCallback, useEffect, useState } from "react";

export const READER_MD_THEME_KEY = "synapse-reader-md-theme";

/** The change event the hook syncs on (same-tab live application). */
const READER_MD_THEME_EVENT = "synapse:reader-md-theme";

export type ReaderMdTheme = "default" | "claudette";

export function getReaderMdTheme(): ReaderMdTheme {
  try {
    return localStorage.getItem(READER_MD_THEME_KEY) === "claudette" ? "claudette" : "default";
  } catch {
    return "default"; // storage unavailable (private mode) — session-only default
  }
}

export function setReaderMdTheme(theme: ReaderMdTheme): void {
  try {
    if (theme === "claudette") localStorage.setItem(READER_MD_THEME_KEY, "claudette");
    else localStorage.removeItem(READER_MD_THEME_KEY); // OFF = the absent key (lazy-write)
  } catch {
    // storage refused — the in-session hook state still applies
  }
  window.dispatchEvent(new CustomEvent(READER_MD_THEME_EVENT));
}

/** The toggle surface: current theme + a setter that persists (lazy) and syncs. */
export function useReaderMdTheme(): [ReaderMdTheme, (theme: ReaderMdTheme) => void] {
  const [theme, setTheme] = useState<ReaderMdTheme>(() => getReaderMdTheme());
  useEffect(() => {
    const sync = () => setTheme(getReaderMdTheme());
    window.addEventListener(READER_MD_THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(READER_MD_THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((next: ReaderMdTheme) => {
    setReaderMdTheme(next);
    setTheme(next);
  }, []);
  return [theme, update];
}
