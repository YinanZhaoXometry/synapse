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

/* ── Materials (retired) ─────────────────────────────── */
// RETIRED (epic P3-18 T3, 2026-11-06): the demo MATERIALS fixture + Material
// interface + MaterialTag/TAG_IDS left with /materials' re-point onto the
// useAllMaterialsQuery read — the page renders only server rows now (wire
// truth: kind · sizeBytes · createdAt · parseState; the scope chip resolves
// real plan/task titles). No demo-data exports have consumers left; the file
// stays as the retirement record per its house pattern.

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
