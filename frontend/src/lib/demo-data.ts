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

/* ── Flashcards ──────────────────────────────────────── */
export interface Flashcard {
  id: string;
  prompt: LangText;
  answer: LangText;
  source: LangText;
}

export const FLASHCARDS: Flashcard[] = [
  { id: "f1", prompt: { zh: "集成测试与单元测试的边界在哪里？", en: "What separates integration testing from unit testing?" }, answer: { zh: "单元测试验证单个模块；集成测试验证模块之间的协作与接口。", en: "Unit tests check one module; integration tests check collaboration and interfaces between modules." }, source: { zh: "Lecture 5 · 第 3 页", en: "Lecture 5 · p.3" } },
  { id: "f2", prompt: { zh: "什么是需求可追溯性？", en: "What is requirements traceability?" }, answer: { zh: "从需求到设计、实现与测试建立双向链接，任何变更都能找到受影响项。", en: "Bidirectional links from requirements to design, implementation, and tests, so every change can find its affected items." }, source: { zh: "Lecture 1 · 第 12 页", en: "Lecture 1 · p.12" } },
  { id: "f3", prompt: { zh: "观察者模式解决什么问题？", en: "What problem does Observer solve?" }, answer: { zh: "一对多依赖：状态变化时自动通知订阅者，同时降低耦合。", en: "A one-to-many dependency: state changes notify subscribers automatically while lowering coupling." }, source: { zh: "设计模式笔记 · 第 4 页", en: "Design patterns notes · p.4" } },
  { id: "f4", prompt: { zh: "边界值分析为什么有效？", en: "Why does boundary-value analysis work?" }, answer: { zh: "缺陷更常出现在输入范围的边缘；取边界与临界值能提高命中率。", en: "Defects cluster at range edges; testing boundaries and thresholds improves the hit rate." }, source: { zh: "Lecture 5 · 第 8 页", en: "Lecture 5 · p.8" } },
  { id: "f5", prompt: { zh: "高内聚、低耦合分别指什么？", en: "What do high cohesion and low coupling mean?" }, answer: { zh: "模块内部职责集中；模块之间依赖尽量少。", en: "Responsibilities stay focused inside a module; dependencies between modules stay few." }, source: { zh: "Lecture 4 · 第 6 页", en: "Lecture 4 · p.6" } },
  { id: "f6", prompt: { zh: "验收测试应该由谁定义？", en: "Who should define acceptance tests?" }, answer: { zh: "由用户或客户与团队共同定义，验证系统是否满足业务需求。", en: "Users or customers define them together with the team, verifying the system meets business needs." }, source: { zh: "Lecture 5 · 第 14 页", en: "Lecture 5 · p.14" } },
  { id: "f7", prompt: { zh: "策略模式的替换点在哪里？", en: "Where does Strategy swap behaviour?" }, answer: { zh: "把可变算法封装成独立类，运行时注入，避免条件分支扩散。", en: "Encapsulate varying algorithms in separate classes and inject them at runtime, avoiding branching sprawl." }, source: { zh: "设计模式笔记 · 第 7 页", en: "Design patterns notes · p.7" } },
  { id: "f8", prompt: { zh: "为什么先写测试？", en: "Why write tests first?" }, answer: { zh: "先把预期变成可执行断言，再实现，能逼出更清晰的接口与边界。", en: "Turn expectations into executable assertions before implementing; clearer interfaces and boundaries follow." }, source: { zh: "Lecture 5 · 第 11 页", en: "Lecture 5 · p.11" } },
];

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
