/**
 * PROTOTYPE (epic-2 UI) — throwaway stub data for the plans prototype. Not production.
 * Scores/states are computed by the REAL domain fns (ADR-0001) on stub evidence, so the
 * display contract ("uncovered counts 0", 100% only when every node is mastered) reads honestly.
 */
import type { EvidenceRecord, KnowledgeNode, Material, NodeState, StudyPlan } from "@/domain/entities";
import { computeNodeScore, getNodeState } from "@/domain/mastery";
import { computePlanRollup } from "@/domain/mastery";
import { computeStreak } from "@/domain/streak";

export interface StubNode extends KnowledgeNode {
  state: NodeState;
  score: number;
  evidence: EvidenceRecord[];
}

export interface StubPlan {
  plan: StudyPlan;
  nodes: StubNode[];
  materials: Material[];
  lastActivity: string;
}

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 24, 0, 0);
  return d.toISOString();
};

const ev = (id: string, nodeId: string, outcome: EvidenceRecord["outcome"], day: number): EvidenceRecord => ({
  id,
  nodeId,
  sessionId: "s-demo",
  questionId: null,
  outcome,
  createdAt: daysAgo(day),
});

function stubNode(n: Omit<KnowledgeNode, "planId" | "taskId">, records: EvidenceRecord[]): StubNode {
  return {
    ...n,
    planId: null,
    taskId: null,
    evidence: records,
    score: computeNodeScore(records),
    state: getNodeState(records),
  };
}

function material(id: string, title: string, kind: Material["kind"], sizeBytes: number): Material {
  return { id, title, kind, sizeBytes, planId: "p-demo-1", taskId: null, parseState: "pending", sections: [], createdAt: daysAgo(1) };
}

// -- Demo plan 1: mid-progress SE exam plan ------------------------------------
const P1_NODES: StubNode[] = [
  stubNode({ id: "n1", stage: "软件过程", title: "软件生命周期模型", order: 0 }, [
    ev("e1", "n1", "correct", 2), ev("e2", "n1", "correct", 1), ev("e3", "n1", "correct", 1),
    ev("e4", "n1", "correct", 0), ev("e5", "n1", "partial", 0),
  ]),
  stubNode({ id: "n2", stage: "软件过程", title: "过程度量与改进", order: 1 }, [
    ev("e6", "n2", "correct", 1), ev("e7", "n2", "partial", 1), ev("e8", "n2", "wrong", 0),
    ev("e9", "n2", "correct", 0), ev("e10", "n2", "partial", 0),
  ]),
  stubNode({ id: "n3", stage: "需求", title: "需求获取与分析", order: 2 }, [
    ev("e11", "n3", "partial", 1), ev("e12", "n3", "partial", 0), ev("e13", "n3", "wrong", 0),
  ]),
  stubNode({ id: "n4", stage: "需求", title: "需求规格与验证", order: 3 }, []),
  stubNode({ id: "n5", stage: "设计", title: "架构设计模式", order: 4 }, []),
  stubNode({ id: "n6", stage: "设计", title: "详细设计与 UML", order: 5 }, []),
  stubNode({ id: "n7", stage: "测试与交付", title: "测试策略与用例设计", order: 6 }, []),
  stubNode({ id: "n8", stage: "测试与交付", title: "交付与维护", order: 7 }, []),
];

const P1: StubPlan = {
  plan: {
    id: "p-demo-1",
    topic: "COMP5241 软件工程 — 期末备考",
    goal: "期末考 85+",
    nodeIds: P1_NODES.map(n => n.id),
    materialIds: ["m1", "m2"],
    createdAt: daysAgo(4),
  },
  nodes: P1_NODES,
  materials: [
    material("m1", "Lecture 4 — Requirements Engineering.pdf", "pdf", 2_140_000),
    material("m2", "复习笔记.md", "markdown", 18_400),
  ],
  lastActivity: "昨天",
};

// -- Demo plan 2: fresh, nothing attached ---------------------------------------
const P2_NODES: StubNode[] = [
  stubNode({ id: "p2n1", stage: "基础", title: "负载均衡与缓存", order: 0 }, []),
  stubNode({ id: "p2n2", stage: "基础", title: "数据库分库分表", order: 1 }, []),
  stubNode({ id: "p2n3", stage: "核心", title: "一致性哈希", order: 2 }, []),
  stubNode({ id: "p2n4", stage: "核心", title: "消息队列削峰", order: 3 }, []),
  stubNode({ id: "p2n5", stage: "进阶", title: "分布式事务", order: 4 }, []),
  stubNode({ id: "p2n6", stage: "进阶", title: "限流与降级", order: 5 }, []),
  stubNode({ id: "p2n7", stage: "应用", title: "秒杀系统设计", order: 6 }, []),
  stubNode({ id: "p2n8", stage: "应用", title: "短链系统设计", order: 7 }, []),
];

const P2: StubPlan = {
  plan: { id: "p-demo-2", topic: "系统设计面试冲刺", goal: null, nodeIds: P2_NODES.map(n => n.id), materialIds: [], createdAt: daysAgo(1) },
  nodes: P2_NODES,
  materials: [],
  lastActivity: "1 天前",
};

export const STUB_PLANS: StubPlan[] = [P1, P2];

/** Honest plan rollup via the real domain fn (uncovered nodes count 0). */
export function rollupOf(nodes: StubNode[]): number {
  return computePlanRollup(Object.fromEntries(nodes.map(n => [n.id, n.evidence])));
}

/** Honest streak: 3 consecutive evidence days (today included). */
export const STREAK = computeStreak([
  ev("sk1", "n1", "correct", 0), ev("sk2", "n2", "correct", 1), ev("sk3", "n1", "correct", 2),
]);

export const RECENT_ACTIVITY = [
  { title: "完成测验「需求获取与分析」", detail: "8 题 · 2 对 3 半对 3 错", when: "昨天 21:40" },
  { title: "上传 Lecture 4 — Requirements Engineering.pdf", detail: "2.1 MB · 待解析", when: "前天 14:05" },
  { title: "创建学习计划", detail: "8 节点 · 4 阶段", when: "4 天前" },
];
