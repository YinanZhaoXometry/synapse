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
export interface PlannerTask {
  id: string;
  key: string;
  metaKey: string;
  minutes: number;
  priority: "high" | "medium" | "low";
  ai: boolean;
  done: boolean;
}

export const DEFAULT_TASKS: PlannerTask[] = [
  { id: "t1", key: "planner.task1", metaKey: "planner.task1Meta", minutes: 25, priority: "high", ai: true, done: false },
  { id: "t2", key: "planner.task2", metaKey: "planner.task2Meta", minutes: 40, priority: "medium", ai: false, done: true },
  { id: "t3", key: "planner.task3", metaKey: "planner.task3Meta", minutes: 12, priority: "low", ai: true, done: false },
  { id: "t4", key: "planner.task4", metaKey: "planner.task4Meta", minutes: 30, priority: "medium", ai: false, done: false },
  { id: "t5", key: "planner.task5", metaKey: "planner.task5Meta", minutes: 20, priority: "high", ai: false, done: false },
];

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
export interface Mistake {
  id: string;
  topic: LangText;
  dateKey: string;
  question: LangText;
  given: LangText;
  correct: LangText;
  note: LangText;
  source: LangText;
}

export const MISTAKES: Mistake[] = [
  {
    id: "mk1",
    topic: { zh: "软件测试", en: "Software testing" },
    dateKey: "mistakes.date1",
    question: { zh: "集成测试的主要目的是什么？", en: "What is the main purpose of integration testing?" },
    given: { zh: "集成测试就是把所有单元测试一次跑完。", en: "Integration testing just runs all the unit tests at once." },
    correct: { zh: "验证模块之间的接口与协作，不会替代单元测试。", en: "Verify interfaces and collaboration between modules; it does not replace unit tests." },
    note: { zh: "把「一起运行」当成了「验证协作」。下一步：为每个接口补一条失败路径。", en: "You treated \"run together\" as \"verify collaboration.\" Next: add one failure path per interface." },
    source: { zh: "COMP5241 Lecture 5 · 第 3 页", en: "COMP5241 Lecture 5 · p.3" },
  },
  {
    id: "mk2",
    topic: { zh: "需求工程", en: "Requirements" },
    dateKey: "mistakes.date2",
    question: { zh: "需求可追溯性最直接的用途是什么？", en: "What is the most direct use of requirements traceability?" },
    given: { zh: "主要是给审计看的。", en: "It is mainly for audits." },
    correct: { zh: "变更时定位受影响的设计、实现与测试。", en: "Locate affected design, implementation, and tests when change happens." },
    note: { zh: "审计只是结果之一。把「变更影响分析」写在便签上，下次先想这一条。", en: "Audit is a side effect. Put \"change-impact analysis\" on a sticky note and reach for it first." },
    source: { zh: "COMP5241 Lecture 1 · 第 12 页", en: "COMP5241 Lecture 1 · p.12" },
  },
  {
    id: "mk3",
    topic: { zh: "设计模式", en: "Design patterns" },
    dateKey: "mistakes.date3",
    question: { zh: "观察者模式让对象之间完全解耦了吗？", en: "Does Observer fully decouple objects?" },
    given: { zh: "是的，订阅者完全不依赖主题。", en: "Yes, subscribers have no dependency on the subject." },
    correct: { zh: "它降低耦合，但订阅者仍依赖主题的接口。", en: "It lowers coupling, but subscribers still depend on the subject interface." },
    note: { zh: "「解耦」不是「零依赖」。记住保留接口这一层依赖，才算真的理解。", en: "\"Lower coupling\" is not \"zero dependency.\" Keep the interface dependency in view." },
    source: { zh: "设计模式笔记 · 第 4 页", en: "Design patterns notes · p.4" },
  },
];

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

/* ── Quiz bank ───────────────────────────────────────── */
export interface QuizQuestion {
  id: string;
  type: "choice" | "open";
  topicKey: MasteryTopic;
  prompt: LangText;
  options?: LangText[];
  answer?: number;
  reference?: LangText;
  hint: LangText;
  why: LangText;
  source: LangText;
  keywords?: { zh: string[]; en: string[] };
}

export const QUIZ_BANK: QuizQuestion[] = [
  {
    id: "q1", type: "choice", topicKey: "testing",
    prompt: { zh: "集成测试的主要目的是什么？", en: "What is the main purpose of integration testing?" },
    options: [
      { zh: "验证单个函数", en: "Verify one function" },
      { zh: "验证模块之间的接口与协作", en: "Verify interfaces and collaboration between modules" },
      { zh: "取代验收测试", en: "Replace acceptance testing" },
      { zh: "测量代码覆盖率", en: "Measure code coverage" },
    ],
    answer: 1,
    hint: { zh: "想「模块之间」，而不是「模块内部」。", en: "Think \"between modules,\" not \"inside one module.\"" },
    why: { zh: "集成测试关注模块拼起来之后的行为：接口契约、数据传递与协作顺序。单元测试解决的是模块内部。", en: "Integration testing looks at behaviour once modules are combined: interface contracts, data passing, and collaboration order. Unit tests cover the inside of one module." },
    source: { zh: "COMP5241 Lecture 5 · 第 3 页", en: "COMP5241 Lecture 5 · p.3" },
  },
  {
    id: "q2", type: "choice", topicKey: "requirements",
    prompt: { zh: "需求可追溯性最直接的用途是什么？", en: "What is the most direct use of requirements traceability?" },
    options: [
      { zh: "让文档更厚", en: "Make documents longer" },
      { zh: "变更时找到受影响的设计与测试", en: "Find affected design and tests when change happens" },
      { zh: "替代用户访谈", en: "Replace user interviews" },
      { zh: "自动生成代码", en: "Generate code automatically" },
    ],
    answer: 1,
    hint: { zh: "从「改一条需求，谁会受影响」倒推。", en: "Work backwards from \"one requirement changes — who is affected?\"" },
    why: { zh: "追溯矩阵把需求与设计、实现、测试连起来，变更影响分析才有依据。审计只是附带结果。", en: "A traceability matrix links requirements to design, implementation, and tests so change-impact analysis has evidence. Audit is a side effect." },
    source: { zh: "COMP5241 Lecture 1 · 第 12 页", en: "COMP5241 Lecture 1 · p.12" },
  },
  {
    id: "q3", type: "open", topicKey: "design",
    prompt: { zh: "用一句话解释「高内聚」。", en: "Explain \"high cohesion\" in one sentence." },
    reference: { zh: "一个模块内部的职责集中、围绕同一目标，改动原因尽量少。", en: "A module keeps its responsibilities focused on one purpose, so it has few reasons to change." },
    hint: { zh: "从「改一处会不会牵动很多无关代码」倒推。", en: "Work backwards from \"does one change drag in unrelated code?\"" },
    why: { zh: "高内聚说的是模块内部：职责越集中，理解与修改的成本越低。它与模块之间的耦合是两件事。", en: "High cohesion is about the inside of a module: the more focused the responsibilities, the cheaper it is to understand and change. Coupling between modules is a separate concern." },
    source: { zh: "COMP5241 Lecture 4 · 第 6 页", en: "COMP5241 Lecture 4 · p.6" },
    keywords: {
      zh: ["职责", "集中", "单一", "模块", "内聚"],
      en: ["responsib", "focus", "single", "module", "cohes"],
    },
  },
  {
    id: "q4", type: "choice", topicKey: "design",
    prompt: { zh: "观察者模式属于哪一类设计模式？", en: "Which category does Observer belong to?" },
    options: [
      { zh: "创建型", en: "Creational" },
      { zh: "结构型", en: "Structural" },
      { zh: "行为型", en: "Behavioural" },
      { zh: "架构型", en: "Architectural" },
    ],
    answer: 2,
    hint: { zh: "它关心对象之间如何通知与响应。", en: "It is about how objects notify and respond to each other." },
    why: { zh: "观察者描述对象之间的通信与职责分配，属于行为型；创建型管对象创建，结构型管组合方式。", en: "Observer describes communication and responsibility between objects, so it is behavioural. Creational patterns handle creation; structural patterns handle composition." },
    source: { zh: "设计模式笔记 · 第 4 页", en: "Design patterns notes · p.4" },
  },
  {
    id: "q5", type: "choice", topicKey: "testing",
    prompt: { zh: "边界值分析最关注哪些输入？", en: "Which inputs does boundary-value analysis target?" },
    options: [
      { zh: "最常见的输入", en: "The most common inputs" },
      { zh: "范围的边缘与临界值", en: "Edges and thresholds of a range" },
      { zh: "随机输入", en: "Random inputs" },
      { zh: "最长的输入", en: "The longest inputs" },
    ],
    answer: 1,
    hint: { zh: "缺陷常常藏在「刚好越界」的地方。", en: "Defects often hide exactly where a value crosses the line." },
    why: { zh: "边界值分析取上界、下界与临界点，因为实现中的比较条件最容易在这些位置出错。", en: "Boundary-value analysis tests upper, lower, and threshold values because comparison logic is most likely to fail there." },
    source: { zh: "COMP5241 Lecture 5 · 第 8 页", en: "COMP5241 Lecture 5 · p.8" },
  },
  {
    id: "q6", type: "open", topicKey: "testing",
    prompt: { zh: "为什么「先写测试」能改善接口设计？", en: "Why does writing tests first improve interface design?" },
    reference: { zh: "测试迫使你先从调用者视角描述预期，接口会更清晰，边界也更早暴露。", en: "Tests force you to describe expectations from the caller side, so interfaces get clearer and boundaries surface earlier." },
    hint: { zh: "想想写测试时，你被迫先决定什么。", en: "Think about what you are forced to decide while writing the test." },
    why: { zh: "测试是接口的第一个使用者。先写测试会把「怎么调用」提前到设计阶段，避免实现完才发现接口难用。", en: "A test is the interface's first user. Writing it first pulls \"how it is called\" into design, before an awkward interface ships." },
    source: { zh: "COMP5241 Lecture 5 · 第 11 页", en: "COMP5241 Lecture 5 · p.11" },
    keywords: {
      zh: ["接口", "调用", "边界", "预期", "使用"],
      en: ["interface", "call", "boundary", "expect", "use"],
    },
  },
  {
    id: "q7", type: "choice", topicKey: "design",
    prompt: { zh: "低耦合最直接的好处是什么？", en: "What is the most direct benefit of low coupling?" },
    options: [
      { zh: "代码行数更少", en: "Fewer lines of code" },
      { zh: "一个模块的改动更少波及其他模块", en: "A change in one module affects fewer others" },
      { zh: "不需要测试", en: "No tests needed" },
      { zh: "运行速度更快", en: "Faster runtime" },
    ],
    answer: 1,
    hint: { zh: "耦合描述的是「改动如何传播」。", en: "Coupling describes how change propagates." },
    why: { zh: "低耦合让模块边界更稳，改动的波及面更小；它不承诺更少代码或更快运行。", en: "Low coupling keeps module boundaries stable and reduces the blast radius of change. It promises neither fewer lines nor faster runtime." },
    source: { zh: "COMP5241 Lecture 4 · 第 6 页", en: "COMP5241 Lecture 4 · p.6" },
  },
  {
    id: "q8", type: "choice", topicKey: "requirements",
    prompt: { zh: "验收测试应该由谁定义？", en: "Who should define acceptance tests?" },
    options: [
      { zh: "只由开发定义", en: "Developers only" },
      { zh: "只由测试定义", en: "Testers only" },
      { zh: "用户或客户与团队共同定义", en: "Users or customers with the team" },
      { zh: "只由 AI 定义", en: "AI only" },
    ],
    answer: 2,
    hint: { zh: "验收测试验证的是「业务上算不算完成」。", en: "Acceptance tests verify whether the business considers it done." },
    why: { zh: "验收标准来自业务需求，必须由需求方与团队共同确认；单方定义容易把「实现正确」误当成「需求满足」。", en: "Acceptance criteria come from business needs and must be agreed by the requester and the team. One side alone can mistake \"implemented correctly\" for \"requirement met.\"" },
    source: { zh: "COMP5241 Lecture 5 · 第 14 页", en: "COMP5241 Lecture 5 · p.14" },
  },
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
