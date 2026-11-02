/**
 * Curated plan-structure templates (spec Q4 decision): keyword detection picks
 * a family; the SE default covers the COMP5241 demo; a generic 4-stage fallback
 * derives node names from the topic string. Deterministic per input. zh+en
 * parity per AD-9 — the generated structure localizes with the request.
 */
import type { ProposedStage, UiLanguage } from "@/ai/types";

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

function seStages(topic: string, language: UiLanguage): ProposedStage[] {
  const t = topic.trim();
  return STAGE_NAMES[language].se.map((name, i) => ({
    name,
    nodeTitles: SE_NODES[language][i].map((title) => (i === 0 ? `${t} · ${title}` : title)),
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
  return STAGE_NAMES[language].generic.map((name, i) => ({ name, nodeTitles: nodeTitles[language][i] }));
}

/** 8–12 nodes across 3–4 stages, deterministic per topic (spec Q4). */
export function planTemplateFor(
  topic: string,
  language: UiLanguage,
): { stages: ProposedStage[]; intro: string } {
  const stages = SE_FAMILY.test(topic) ? seStages(topic, language) : genericStages(topic, language);
  return { stages, intro: INTRO[language] };
}
