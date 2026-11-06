/**
 * Curated plan-structure templates (spec Q4 decision): keyword detection picks
 * a family; the SE default covers the COMP5241 demo; a generic 4-stage fallback
 * derives node names from the topic string. Deterministic per input. zh+en
 * parity per AD-9 — the generated structure localizes with the request.
 * epic-16: stages carry nodes (metadata-less here — the double proposes bare
 * titles) + a deterministic stage-forward edge chain (each stage's head node
 * hangs off the previous stage's head), so the double's drafts exercise the
 * same title-paired edge shape the server's proposals carry.
 */
import type { PlanStructureProposal, ProposedStage, UiLanguage } from "@/ai/types";

const SE_FAMILY = /软件|工程|测试|需求|架构|agile|software|engineer|testing|requirement|architect|design pattern|scrum/i;

const STAGE_NAMES: Record<UiLanguage, { se: string[]; generic: string[] }> = {
  zh: { se: ["软件过程", "需求", "设计", "测试与交付"], generic: ["基础", "核心", "进阶", "应用"] },
  en: { se: ["Process", "Requirements", "Design", "Testing & Delivery"], generic: ["Foundations", "Core", "Advanced", "Application"] },
};

const SE_NODES: Record<UiLanguage, string[][]> = {
  zh: [
    ["软件生命周期", "过程模型与敏捷"],
    ["需求获取与澄清", "需求规约与验收标准"],
    ["架构与设计原则", "UML 建模基础"],
    ["测试层级与集成测试", "质量属性与交付"],
  ],
  en: [
    ["Software lifecycle", "Process models & agile"],
    ["Requirements elicitation", "Specs & acceptance criteria"],
    ["Architecture & design principles", "UML modeling basics"],
    ["Test levels & integration testing", "Quality attributes & delivery"],
  ],
};

const INTRO: Record<UiLanguage, string> = {
  zh: "好——我按阶段搭好了学习骨架，确认后就可以附上你的材料。",
  en: "Done — here's the staged skeleton. Confirm it, then attach your materials.",
};

function headChainEdges(stages: ProposedStage[]): [string, string][] {
  // Stage-forward by construction: each later stage's head node depends on the
  // previous stage's head node (titles are unique within the template).
  const edges: [string, string][] = [];
  for (let i = 1; i < stages.length; i += 1) {
    const from = stages[i - 1].nodes[0];
    const to = stages[i].nodes[0];
    if (from && to) edges.push([from.title, to.title]);
  }
  return edges;
}

function seStages(topic: string, language: UiLanguage): ProposedStage[] {
  const t = topic.trim();
  return STAGE_NAMES[language].se.map((name, i) => ({
    name,
    nodes: SE_NODES[language][i].map((title) => ({ title: i === 0 ? `${t} · ${title}` : title })),
  }));
}

function genericStages(topic: string, language: UiLanguage): ProposedStage[] {
  const t = topic.trim();
  const nodeTitles: Record<UiLanguage, string[][]> = {
    zh: [
      [`${t} 是什么`, `${t} 的核心概念`],
      [`${t} 的关键机制`, `${t} 常见问题`],
      [`${t} 的深入专题`, `${t} 与相邻领域`],
      [`${t} 的实际应用`, `${t} 自测与巩固`],
    ],
    en: [
      [`What is ${t}`, `Core concepts of ${t}`],
      [`Key mechanisms of ${t}`, `Common pitfalls in ${t}`],
      [`Advanced topics in ${t}`, `${t} and its neighbors`],
      [`Applying ${t}`, `Self-test & consolidation`],
    ],
  };
  return STAGE_NAMES[language].generic.map((name, i) => ({
    name,
    nodes: nodeTitles[language][i].map((title) => ({ title })),
  }));
}

/** 8–12 nodes across 3–4 stages, deterministic per topic (spec Q4). */
export function planTemplateFor(
  topic: string,
  language: UiLanguage,
): { proposal: PlanStructureProposal; intro: string } {
  const stages = SE_FAMILY.test(topic) ? seStages(topic, language) : genericStages(topic, language);
  return {
    proposal: { topic: topic.trim(), stages, edges: headChainEdges(stages), language },
    intro: INTRO[language],
  };
}
