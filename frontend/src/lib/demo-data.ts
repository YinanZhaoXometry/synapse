// Demo data transcribed from docs/design/northstar-import/prototype-v2/app.js (2026-11-02).
// Bilingual strings are { zh, en } objects — resolve with pickL(obj, language).

export type LangText = { zh: string; en: string };
export type Lang = "zh" | "en";

export function pickL(obj: LangText | null | undefined, lang: Lang): string {
  if (!obj) return "";
  return obj[lang] != null ? obj[lang] : obj.zh || "";
}

export function fmtNum(n: number): string {
  return Number(n).toLocaleString("en-US");
}

/* ── Mastery ─────────────────────────────────────────── */
export type MasteryTopic = "design" | "requirements" | "testing";

export const TOPICS: Record<MasteryTopic, LangText> = {
  design: { zh: "软件设计", en: "Software design" },
  requirements: { zh: "需求工程", en: "Requirements" },
  testing: { zh: "软件测试", en: "Software testing" },
};

export const DEFAULT_MASTERY: Record<MasteryTopic, number> = { design: 84, requirements: 61, testing: 47 };

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

/* ── Achievements ────────────────────────────────────── */
export interface Badge {
  id: string;
  emoji: string;
  key: string;
  desc: string;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Badge[] = [
  { id: "b1", emoji: "🎯", key: "ach.b1", desc: "ach.b1d", unlocked: true },
  { id: "b2", emoji: "🔥", key: "ach.b2", desc: "ach.b2d", unlocked: true },
  { id: "b3", emoji: "🔥", key: "ach.b3", desc: "ach.b3d", unlocked: false },
  { id: "b4", emoji: "🃏", key: "ach.b4", desc: "ach.b4d", unlocked: true },
  { id: "b5", emoji: "💯", key: "ach.b5", desc: "ach.b5d", unlocked: false },
  { id: "b6", emoji: "🧭", key: "ach.b6", desc: "ach.b6d", unlocked: true },
  { id: "b7", emoji: "🧱", key: "ach.b7", desc: "ach.b7d", unlocked: false },
  { id: "b8", emoji: "🔍", key: "ach.b8", desc: "ach.b8d", unlocked: false },
  { id: "b9", emoji: "🧪", key: "ach.b9", desc: "ach.b9d", unlocked: false },
  { id: "b10", emoji: "⏳", key: "ach.b10", desc: "ach.b10d", unlocked: true },
  { id: "b11", emoji: "🌿", key: "ach.b11", desc: "ach.b11d", unlocked: false },
  { id: "b12", emoji: "🎓", key: "ach.b12", desc: "ach.b12d", unlocked: false },
];

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

/* ── Analytics ───────────────────────────────────────── */
export const WEEK_VALUES = [45, 70, 35, 85, 60, 95, 78];
export const WEEK_DAYS: Record<Lang, string[]> = {
  zh: ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
export const ACCURACY_VALUES = [68, 72, 70, 75, 78, 80, 82];
export const TOPIC_ROWS: Array<{ key: string; value?: number; topic?: MasteryTopic }> = [
  { key: "analytics.topicUsability", value: 72 },
  { key: "analytics.topicCognition", value: 55 },
  { key: "analytics.topicDesign", topic: "design" },
  { key: "analytics.topicRequirements", topic: "requirements" },
  { key: "analytics.topicTesting", topic: "testing" },
];

/* ── Progress defaults ───────────────────────────────── */
export const DEFAULT_PROGRESS = {
  points: 1750,
  streak: 5,
  level: 4,
  quizzesCompleted: 12,
  flashcardsReviewed: 46,
  studyMinutes: 468,
  correctAnswers: 124,
  totalAnswers: 151,
  weeklyGoal: 25,
  weeklyProgress: 17,
};
