/**
 * Curated plan-structure templates (spec Q4 decision): keyword detection picks
 * a family; the SE default covers the COMP5241 demo; a generic 4-stage fallback
 * derives node names from the topic string. Deterministic per input.
 */
import type { ProposedStage, UiLanguage } from "@/ai/types";

const SE_STAGE_KEYS = ["软件过程", "需求", "设计", "测试与交付"] as const;
const GENERIC_STAGE_KEYS = ["基础", "核心", "进阶", "应用"] as const;

const SE_FAMILY = /软件|工程|测试|需求|架构|agile|software|engineer|testing|requirement|architect|design pattern|scrum/i;

interface TemplateCopy {
  intro: string;
}

const INTRO: Record<UiLanguage, TemplateCopy> = {
  zh: {
    intro: "好——我按阶段搭好了学习骨架，确认后就可以附上你的材料。",
  },
  en: {
    intro: "Done — here's the staged skeleton. Confirm it, then attach your materials.",
  },
};

function seStages(topic: string): ProposedStage[] {
  const t = topic.trim();
  return [
    { name: SE_STAGE_KEYS[0], nodeTitles: [`${t} · 软件生命周期`, "过程模型与敏捷"] },
    { name: SE_STAGE_KEYS[1], nodeTitles: ["需求获取与澄清", "需求规约与验收标准"] },
    { name: SE_STAGE_KEYS[2], nodeTitles: ["架构与设计原则", "UML 建模基础"] },
    { name: SE_STAGE_KEYS[3], nodeTitles: ["测试层级与集成测试", "质量属性与交付"] },
  ];
}

function genericStages(topic: string): ProposedStage[] {
  const t = topic.trim();
  return [
    { name: GENERIC_STAGE_KEYS[0], nodeTitles: [`${t} 是什么`, `${t} 的核心概念`] },
    { name: GENERIC_STAGE_KEYS[1], nodeTitles: [`${t} 的关键机制`, `${t} 常见问题`] },
    { name: GENERIC_STAGE_KEYS[2], nodeTitles: [`${t} 的深入专题`, `${t} 与相邻领域`] },
    { name: GENERIC_STAGE_KEYS[3], nodeTitles: [`${t} 的实际应用`, `${t} 自测与巩固`] },
  ];
}

/** 8–12 nodes across 3–4 stages, deterministic per topic (spec Q4). */
export function planTemplateFor(
  topic: string,
  language: UiLanguage,
): { stages: ProposedStage[]; intro: string } {
  const stages = SE_FAMILY.test(topic) ? seStages(topic) : genericStages(topic);
  return { stages, intro: INTRO[language].intro };
}
