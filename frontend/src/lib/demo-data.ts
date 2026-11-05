// Demo data transcribed from docs/design/northstar-import/prototype-v2/app.js (2026-11-02).
// Bilingual strings are { zh, en } objects — resolve with pickL(obj, language).

export type LangText = { zh: string; en: string };
export type Lang = "zh" | "en";

export function pickL(obj: LangText | null | undefined, lang: Lang): string {
  if (!obj) return "";
  return obj[lang] != null ? obj[lang] : obj.zh || "";
}

/* ── Mastery (retired) ───────────────────────────────── */
// RETIRED (epic P2-09 T6, 2026-11-05): the demo mastery topics/values died
// with the demo progress context (its last consumer — the frozen scaffold's
// three-subject model was generalized long ago; real mastery is per-node,
// server-computed, AD-14).

/* ── Materials ───────────────────────────────────────── */
export type MaterialTag = "course" | "notes" | "exam";

export interface Material {
  id: string;
  title: LangText;
  type: "pdf" | "md";
  pages: number;
  size: string;
  tag: MaterialTag;
  updated: LangText;
}

export const MATERIALS: Material[] = [
  { id: "m1", title: { zh: "COMP5241 Lecture 4 — 软件设计", en: "COMP5241 Lecture 4 — Software design" }, type: "pdf", pages: 24, size: "3.2 MB", tag: "course", updated: { zh: "2 天前", en: "2 days ago" } },
  { id: "m2", title: { zh: "COMP5241 Lecture 5 — 测试与交付", en: "COMP5241 Lecture 5 — Testing and delivery" }, type: "pdf", pages: 18, size: "2.6 MB", tag: "course", updated: { zh: "2 天前", en: "2 days ago" } },
  { id: "m3", title: { zh: "需求工程速记", en: "Requirements engineering notes" }, type: "md", pages: 6, size: "18 KB", tag: "notes", updated: { zh: "4 天前", en: "4 days ago" } },
  { id: "m4", title: { zh: "期末复习清单", en: "Final exam checklist" }, type: "md", pages: 4, size: "12 KB", tag: "exam", updated: { zh: "1 天前", en: "1 day ago" } },
  { id: "m5", title: { zh: "设计模式笔记", en: "Design patterns notes" }, type: "pdf", pages: 12, size: "1.1 MB", tag: "notes", updated: { zh: "6 天前", en: "6 days ago" } },
];

export const TAG_IDS: Array<"all" | MaterialTag> = ["all", "course", "notes", "exam"];

/* ── Planner ─────────────────────────────────────────── */
// RETIRED (epic P2-09 T3, 2026-11-05): the demo PlannerTask fixture +
// DEFAULT_TASKS left with /planner's re-point onto the todayHub read model —
// the page renders only server rows now (due reviews, manual tasks,
// suggestions). Other demo-data exports stay until their own tickets retire
// them.

/* ── Achievements (retired) ──────────────────────────── */
// RETIRED (epic P2-09 T6, 2026-11-05): the demo achievements fixture + its
// Badge interface left with /achievements' re-point onto the badgeState read
// model — the page renders only server rows now (the emoji faces live in
// lib/badges.ts, shared with the dashboard). Other demo-data exports stay
// until their own tickets retire them.

/* ── Mistakes ────────────────────────────────────────── */
// RETIRED (epic P2-09 T2, 2026-11-05): the demo Mistake fixture + interface
// left with /mistakes' re-point onto the mistakesHub read model — the page
// consumes only the hub hook now. Other demo-data exports stay until their
// own tickets retire them.

/* ── flashcards (retired) ────────────────────────────── */
// RETIRED (epic P2-09 T4, 2026-11-05): the demo flashcard deck + its interface
// left with /flashcards' re-point onto the flashcardDecksHub read model — the
// page consumes only the hub hook now (study launches into the real flow
// routes). Other demo-data exports stay until their own tickets retire them.

/* ── Analytics (retired) ─────────────────────────────── */
// RETIRED (epic P2-09 T5, 2026-11-05): the demo analytics fixtures (the week
// minutes, weekday labels, accuracy values, topic rows) left with /analytics's
// re-point onto the analyticsSeries read model — the page renders only the
// server series now (node mastery / weekly accuracy / 14-day consistency).
// Other demo-data exports stay until their own tickets retire them.

/* ── Progress defaults (retired) ─────────────────────── */
// RETIRED (epic P2-09 T6, 2026-11-05): the demo progress constants (points/
// level/streak/quizzes/minutes...) died with UserProgressContext — the
// provider, its reads (AppLayout footer, Settings profile meta), and the
// AchievementsPage demo stats all consumed them, and nothing real existed on
// the wire to re-point them to (UserType carries id/email/createdAt only).
// Nothing new builds on points (FR-28's stance).
