/**
 * PROTOTYPE — floating scene switcher (throwaway, gated to dev builds).
 * ← / → buttons and arrow keys cycle the walkthrough scenes; the current
 * scene lives in the ?scene= URL param so any screen is shareable/reloadable.
 * The right side surfaces the live shared state (evidence count, rollup,
 * streak) so scene changes are visible without leaving the current view.
 */
import { useEffect } from "react";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { SCENES, useL, type SceneKey } from "./demo";

export default function Switcher({
  current,
  onNavigate,
  stats,
}: {
  current: SceneKey;
  onNavigate: (scene: SceneKey) => void;
  stats: { rollup: number; evidenceCount: number; streak: number };
}) {
  const l = useL();
  const index = Math.max(0, SCENES.findIndex((s) => s.key === current));
  const step = (delta: number) => {
    const next = (index + delta + SCENES.length) % SCENES.length;
    onNavigate(SCENES[next].key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;

  const scene = SCENES[index];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full border border-border-soft bg-[var(--glass-solid)] shadow-raised px-1.5 py-1.5 backdrop-blur">
      <span className="hidden sm:inline-flex items-center gap-1 pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--partial-ink)]">
        <FlaskConical className="w-3 h-3" aria-hidden="true" /> {l("原型", "PROTO")}
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={l("上一个场景", "Previous scene")}
        className="w-7 h-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-3)] cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="flex items-center gap-1.5 px-1.5 min-w-[150px] justify-center" aria-live="polite">
        <scene.icon className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
        <span className="text-xs font-semibold truncate">
          {index + 1}/{SCENES.length} · {l(scene.zh, scene.en)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={l("下一个场景", "Next scene")}
        className="w-7 h-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-3)] cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="hidden md:inline-block border-l border-border-soft ml-1 pl-2.5 pr-2 text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
        {l("掌握", "Mastery")} <b className="text-foreground font-display">{stats.rollup}%</b> ·{" "}
        {l("证据", "Evidence")} <b className="text-foreground">{stats.evidenceCount}</b> ·{" "}
        {l("连击", "Streak")} <b className="text-foreground">{stats.streak}</b>
      </span>
    </div>
  );
}
