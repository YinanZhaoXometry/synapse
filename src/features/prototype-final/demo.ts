/**
 * PROTOTYPE — throwaway (branch prototype/final-system, do not merge).
 * Question answered: "what will the finished Synapse look like end-to-end?"
 *
 * One coherent 8-scene walkthrough of the final system (not competing design
 * variants — the design language is already locked by the northstar passes;
 * the open question was the finished whole, not a direction).
 *
 * Everything here is in-memory. The one mutable state is the flat evidence
 * array, which flows through the REAL ADR-0001 mastery functions — answer the
 * quiz scene and the plan/dashboard numbers move for real. Nothing persists.
 */
import type { LucideIcon } from "lucide-react";
import { BookOpen, ClipboardCheck, LayoutDashboard, ListTree, Map, Sparkles, Sun, Layers } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { EvidenceRecord, Flashcard, KnowledgeNode, Material, MistakeEntry, ReadingLocator, StudyPlan } from "@/domain/entities";

/** Inline bilingual literal — prototype-grade i18n that follows the app language. */
export function useL() {
  const { language } = useLanguage();
  return (zh: string, en: string) => (language === "zh" ? zh : en);
}

const DAY = 86_400_000;
/** ISO timestamp n days ago (n=0 → now, so the streak is always alive). */
const iso = (daysAgo: number) =>
  (daysAgo === 0 ? new Date() : new Date(Date.now() - daysAgo * DAY)).toISOString();

// ---------------------------------------------------------------------------
// Scene registry (the floating switcher walks this list; ←/→ keys cycle it)
// ---------------------------------------------------------------------------

export type SceneKey =
  | "onboarding"
  | "plans"
  | "plan"
  | "reader"
  | "quiz"
  | "today"
  | "review"
  | "dashboard";

export interface SceneDef {
  key: SceneKey;
  icon: LucideIcon;
  zh: string;
  en: string;
}

export const SCENES: SceneDef[] = [
  { key: "onboarding", icon: Sparkles, zh: "入门向导", en: "Onboarding" },
  { key: "plans", icon: Map, zh: "计划前台", en: "Plans Home" },
  { key: "plan", icon: ListTree, zh: "计划主页", en: "Plan Home" },
  { key: "reader", icon: BookOpen, zh: "阅读 + 伴侣", en: "Reader + Companion" },
  { key: "quiz", icon: ClipboardCheck, zh: "测验 · 证据闭环", en: "Quiz · Evidence" },
  { key: "today", icon: Sun, zh: "今日学习", en: "Today" },
  { key: "review", icon: Layers, zh: "闪卡 · 错题", en: "Cards · Mistakes" },
  { key: "dashboard", icon: LayoutDashboard, zh: "总览仪表盘", en: "Dashboard" },
];

// ---------------------------------------------------------------------------
// Shared mutable state (host page owns it; scenes receive it via props)
// ---------------------------------------------------------------------------

export interface ProtoState {
  evidence: EvidenceRecord[];
  addEvidence: (records: EvidenceRecord[]) => void;
  todayDone: Record<string, boolean>;
  toggleToday: (id: string) => void;
  go: (scene: SceneKey) => void;
}

// ---------------------------------------------------------------------------
// Seed: one rich plan (机器学习面试冲刺) + one older plan, real-shaped entities
// ---------------------------------------------------------------------------

export const demoPlans: StudyPlan[] = [
  {
    id: "p-ml",
    topic: "机器学习面试冲刺",
    goal: "3 个月内冲刺算法工程师面试",
    nodeIds: ["n-math", "n-py", "n-sup", "n-eval", "n-nn", "n-ens", "n-dl", "n-int"],
    materialIds: ["m-book", "m-notes"],
    createdAt: iso(12),
  },
  {
    id: "p-lin",
    topic: "线性代数速通",
    goal: "补齐矩阵求导短板",
    nodeIds: ["n-lin1", "n-lin2", "n-lin3"],
    materialIds: ["m-lin"],
    createdAt: iso(30),
  },
];

export const demoNodes: KnowledgeNode[] = [
  { id: "n-math", planId: "p-ml", taskId: null, stage: "基础", title: "数学基础回顾", order: 1 },
  { id: "n-py", planId: "p-ml", taskId: null, stage: "基础", title: "Python 与 NumPy 工具链", order: 2 },
  { id: "n-sup", planId: "p-ml", taskId: null, stage: "核心", title: "监督学习", order: 3 },
  { id: "n-eval", planId: "p-ml", taskId: null, stage: "核心", title: "模型评估与调参", order: 4 },
  { id: "n-nn", planId: "p-ml", taskId: null, stage: "核心", title: "神经网络基础", order: 5 },
  { id: "n-ens", planId: "p-ml", taskId: null, stage: "进阶", title: "集成方法", order: 6 },
  { id: "n-dl", planId: "p-ml", taskId: null, stage: "进阶", title: "深度学习调参实践", order: 7 },
  { id: "n-int", planId: "p-ml", taskId: null, stage: "应用", title: "面试模拟与复盘", order: 8 },
  { id: "n-lin1", planId: "p-lin", taskId: null, stage: null, title: "行变换与秩", order: 1 },
  { id: "n-lin2", planId: "p-lin", taskId: null, stage: null, title: "特征值与特征向量", order: 2 },
  { id: "n-lin3", planId: "p-lin", taskId: null, stage: null, title: "矩阵求导", order: 3 },
];

/**
 * Seed evidence. Expected numbers under the shipped ADR-0001 math:
 * 数学基础 83% mastered · Python 99% partial (gate note!) · 监督学习 50% partial
 * (刚错了一题) · 模型评估 50% partial (证据不足) · 线性代数 plan rollup 50%.
 * Days 0–6 covered consecutively → evidence streak 7.
 */
export const seedEvidence: EvidenceRecord[] = [
  { id: "ev-1", nodeId: "n-math", sessionId: "s-old-1", questionId: null, outcome: "correct", createdAt: iso(6) },
  { id: "ev-2", nodeId: "n-math", sessionId: "s-old-2", questionId: null, outcome: "correct", createdAt: iso(5) },
  { id: "ev-3", nodeId: "n-py", sessionId: "s-old-3", questionId: null, outcome: "correct", createdAt: iso(5) },
  { id: "ev-4", nodeId: "n-math", sessionId: "s-old-4", questionId: null, outcome: "partial", createdAt: iso(3) },
  { id: "ev-5", nodeId: "n-py", sessionId: "s-old-5", questionId: null, outcome: "correct", createdAt: iso(4) },
  { id: "ev-6", nodeId: "n-sup", sessionId: "s-old-6", questionId: null, outcome: "correct", createdAt: iso(2) },
  { id: "ev-7", nodeId: "n-sup", sessionId: "s-old-7", questionId: null, outcome: "partial", createdAt: iso(1) },
  { id: "ev-8", nodeId: "n-sup", sessionId: "s-prev-1", questionId: null, outcome: "wrong", createdAt: iso(0) },
  { id: "ev-9", nodeId: "n-eval", sessionId: "s-prev-1", questionId: null, outcome: "correct", createdAt: iso(1) },
  { id: "ev-10", nodeId: "n-eval", sessionId: "s-prev-1", questionId: null, outcome: "wrong", createdAt: iso(1) },
  { id: "ev-11", nodeId: "n-lin1", sessionId: "s-lin-1", questionId: null, outcome: "correct", createdAt: iso(20) },
  { id: "ev-12", nodeId: "n-lin1", sessionId: "s-lin-1", questionId: null, outcome: "correct", createdAt: iso(19) },
  { id: "ev-13", nodeId: "n-lin1", sessionId: "s-lin-1", questionId: null, outcome: "correct", createdAt: iso(18) },
  { id: "ev-14", nodeId: "n-lin1", sessionId: "s-lin-2", questionId: null, outcome: "correct", createdAt: iso(16) },
  { id: "ev-15", nodeId: "n-lin2", sessionId: "s-lin-3", questionId: null, outcome: "correct", createdAt: iso(14) },
  { id: "ev-16", nodeId: "n-lin2", sessionId: "s-lin-3", questionId: null, outcome: "wrong", createdAt: iso(13) },
];

// ---------------------------------------------------------------------------
// Materials with real parsed sections (final system: parse done, generation live)
// ---------------------------------------------------------------------------

const PAGE3_TEXT = `监督学习是使用带标签数据训练模型的范式：给定输入 X 与对应标签 y，模型学习从 X 到 y 的映射。与之相对，无监督学习只面对无标签数据。

线性回归预测连续值；逻辑回归虽名为回归，实为分类模型——它在线性输出之上套一个 Sigmoid 函数，把输出压缩到 (0,1) 区间，解释为属于正类的概率。

训练逻辑回归时通常最小化交叉熵损失（对数损失），而非均方误差：交叉熵的梯度不含 Sigmoid 导数因子，在错误很大时梯度依然充足，收敛更快、不易陷入平坦区。

决策边界是模型输出概率等于 0.5 的等值线。正则化强度（L1/L2）控制边界复杂度：正则越强，边界越平滑，训练误差上升但泛化往往更好。`;

const PAGE12_TEXT = `精确率 = TP / (TP + FP)，回答"预测为正的里面有多少真的是正"；召回率 = TP / (TP + FN)，回答"真正的正例里有多少被抓到"。二者通常此消彼长，由分类阈值调节。`;

export const demoMaterials: Material[] = [
  {
    id: "m-book",
    title: "机器学习实战（第2版）.pdf",
    kind: "pdf",
    sizeBytes: 14_233_784,
    planId: "p-ml",
    taskId: null,
    parseState: "parsed",
    sections: [
      { id: "page-2", title: "第 2 页 · 机器学习基础", text: "机器学习的三要素：模型、策略、算法。" },
      { id: "page-3", title: "第 3 页 · 监督学习", text: PAGE3_TEXT },
      { id: "page-12", title: "第 12 页 · 模型评估", text: PAGE12_TEXT },
    ],
    createdAt: iso(9),
  },
  {
    id: "m-notes",
    title: "面试笔记-算法岗.md",
    kind: "markdown",
    sizeBytes: 47_616,
    planId: "p-ml",
    taskId: null,
    parseState: "parsed",
    sections: [
      { id: "overfit", title: "过拟合与正则化", text: "过拟合：训练误差低、泛化误差高。缓解：正则化、早停、数据增强、Dropout。" },
    ],
    createdAt: iso(7),
  },
  {
    id: "m-lin",
    title: "线性代数讲义.pdf",
    kind: "pdf",
    sizeBytes: 3_145_728,
    planId: "p-lin",
    taskId: null,
    parseState: "parsed",
    sections: [{ id: "page-1", title: "第 1 页 · 秩与行变换", text: "初等行变换不改变矩阵的秩。" }],
    createdAt: iso(28),
  },
];

// ---------------------------------------------------------------------------
// Quiz questions (materials-sourced provenance, node-attributed)
// ---------------------------------------------------------------------------

export interface DemoQuestion {
  id: string;
  nodeId: string;
  nodeTitle: string;
  kind: "choice" | "open";
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  keywords?: string[];
  sourceLocator: ReadingLocator;
  sourceLabel: string;
  explanation: string;
}

export const demoQuestions: DemoQuestion[] = [
  {
    id: "q-1",
    nodeId: "n-sup",
    nodeTitle: "监督学习",
    kind: "choice",
    prompt: "训练逻辑回归模型时，通常最小化哪种损失函数？",
    options: ["均方误差 (MSE)", "交叉熵（对数损失）", "Hinge 损失", "0-1 损失"],
    correctOptionIndex: 1,
    sourceLocator: { kind: "pdf", page: 3 },
    sourceLabel: "《机器学习实战》第 3 页",
    explanation:
      "交叉熵损失的梯度不含 Sigmoid 导数因子：错误越大梯度越充足，收敛更快。均方误差在输出饱和时梯度趋近于零，容易学不动。",
  },
  {
    id: "q-2",
    nodeId: "n-eval",
    nodeTitle: "模型评估与调参",
    kind: "open",
    prompt: "解释精确率与召回率的权衡，并举一个宁可牺牲精确率也要保召回率的场景。",
    keywords: ["精确率", "召回率", "漏报", "误报", "阈值", "癌症", "欺诈", "召回"],
    sourceLocator: { kind: "pdf", page: 12 },
    sourceLabel: "《机器学习实战》第 12 页",
    explanation:
      "阈值调低 → 召回率升高、精确率下降。漏报代价高的场景（癌症筛查、欺诈检测）宁可多误报也不能漏：先保召回率，再用二次复核收敛精确率。",
  },
];

/** Simulated open-answer grading: keyword coverage → outcome. */
export function gradeOpenAnswer(answer: string, keywords: string[]): "correct" | "partial" | "wrong" {
  const hits = keywords.filter((k) => answer.includes(k)).length;
  if (hits >= 2) return "correct";
  if (hits === 1) return "partial";
  return "wrong";
}

// ---------------------------------------------------------------------------
// Flashcards + mistakes (aggregated hubs, final-system state)
// ---------------------------------------------------------------------------

export const demoFlashcards: Flashcard[] = [
  {
    id: "fc-1",
    materialId: "m-book",
    nodeId: "n-sup",
    front: "逻辑回归为什么用交叉熵而不是均方误差？",
    back: "交叉熵的梯度不含 Sigmoid 导数因子，错误越大梯度越充足，收敛快、不易饱和；MSE 在输出饱和时梯度趋近于零。",
    difficulty: null,
    createdAt: iso(5),
  },
  {
    id: "fc-2",
    materialId: "m-book",
    nodeId: "n-eval",
    front: "精确率和召回率分别回答什么问题？",
    back: "精确率：预测为正的里面有多少真是正（TP/(TP+FP)）；召回率：真正的正例里有多少被抓到（TP/(TP+FN)）。",
    difficulty: null,
    createdAt: iso(5),
  },
  {
    id: "fc-3",
    materialId: "m-notes",
    nodeId: "n-nn",
    front: "过拟合的四种常见缓解手段？",
    back: "正则化（L1/L2）、早停、数据增强、Dropout。",
    difficulty: null,
    createdAt: iso(4),
  },
  {
    id: "fc-4",
    materialId: "m-book",
    nodeId: "n-ens",
    front: "Bagging 与 Boosting 的核心区别？",
    back: "Bagging 并行训练独立基学习器后聚合（降方差）；Boosting 串行训练、每轮聚焦上一轮的错误（降偏差）。",
    difficulty: null,
    createdAt: iso(3),
  },
];

export const demoMistakes: MistakeEntry[] = [
  {
    id: "mk-1",
    questionId: "q-1",
    sessionId: "s-prev-1",
    nodeId: "n-sup",
    userAnswer: "均方误差 (MSE)",
    sourceLocation: { kind: "pdf", page: 3 },
    forfeited: false,
    createdAt: iso(0),
  },
  {
    id: "mk-2",
    questionId: "q-2",
    sessionId: "s-prev-1",
    nodeId: "n-eval",
    userAnswer: "（点了「看答案」放弃）",
    sourceLocation: { kind: "pdf", page: 12 },
    forfeited: true,
    createdAt: iso(0),
  },
];

// ---------------------------------------------------------------------------
// Today queue (今日学习 — aggregated daily task list, not a calendar)
// ---------------------------------------------------------------------------

export interface TodayItem {
  id: string;
  icon: "read" | "quiz" | "cards" | "mistakes";
  zhTitle: string;
  enTitle: string;
  zhMeta: string;
  enMeta: string;
  minutes: number;
  scene: SceneKey;
}

export const todayItems: TodayItem[] = [
  {
    id: "t-0",
    icon: "cards",
    zhTitle: "晨间闪卡 · 5 张",
    enTitle: "Morning flashcards · 5",
    zhMeta: "昨天学过的概念，趁记忆流失前过一遍",
    enMeta: "Concepts from yesterday, before they fade",
    minutes: 5,
    scene: "review",
  },
  {
    id: "t-1",
    icon: "read",
    zhTitle: "继续阅读《机器学习实战》第 3 页",
    enTitle: "Continue reading ML in Action, p.3",
    zhMeta: "监督学习 · 上次读到 62%",
    enMeta: "Supervised learning · left off at 62%",
    minutes: 15,
    scene: "reader",
  },
  {
    id: "t-2",
    icon: "quiz",
    zhTitle: "「监督学习 · 模型评估」混合小测",
    enTitle: "Mixed quiz: supervised learning + evaluation",
    zhMeta: "2 题 · 来源：你的教材与笔记",
    enMeta: "2 questions · sourced from your materials",
    minutes: 10,
    scene: "quiz",
  },
  {
    id: "t-3",
    icon: "mistakes",
    zhTitle: "重练 2 道错题",
    enTitle: "Retry 2 mistakes",
    zhMeta: "昨天错的题 · 答对可回血掌握度",
    enMeta: "Missed yesterday · correct answers heal mastery",
    minutes: 8,
    scene: "review",
  },
  {
    id: "t-4",
    icon: "cards",
    zhTitle: "新卡生成：第 3 页 · 4 张",
    enTitle: "New cards generated: p.3 · 4",
    zhMeta: "阅读完成后自动生成，待确认",
    enMeta: "Auto-generated after reading, pending review",
    minutes: 3,
    scene: "review",
  },
];
