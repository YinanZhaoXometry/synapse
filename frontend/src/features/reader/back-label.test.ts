/**
 * The reader's plan-origin back label settles ONCE (epic-25 T4, audit #11):
 * the 返回计划 placeholder holds for the whole planQuery flight — query data
 * (including a refetch's stale topic) never renders mid-flight — the topic
 * lands only when the read has settled, and a failed/empty read keeps the
 * placeholder as the honest permanent label. The header span's min-w guard
 * (ReaderPage's JSX) keeps the button width stable across that one settle;
 * this pins the decision seam the render consumes.
 */
import { describe, expect, it } from "vitest";
import { translations } from "@/contexts/i18n-dictionary";
import { planBackLabel } from "./ReaderPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const FALLBACK = zhDict["reader.backToPlan"];

describe("planBackLabel — the settle-once back label (audit #11)", () => {
  it("holds the placeholder through the whole flight — even stale data present mid-flight never flips it", () => {
    expect(FALLBACK).toBe("返回计划");
    expect(planBackLabel({ loading: true }, FALLBACK)).toBe(FALLBACK);
    expect(planBackLabel({ loading: true, data: { plan: { topic: "旧主题" } } }, FALLBACK)).toBe(FALLBACK);
  });

  it("settles to the topic exactly once, when the read lands", () => {
    expect(planBackLabel({ loading: false, data: { plan: { topic: "线性代数" } } }, FALLBACK)).toBe("线性代数");
  });

  it("keeps the placeholder as the honest permanent label on a failed or empty read", () => {
    expect(planBackLabel({ loading: false }, FALLBACK)).toBe(FALLBACK);
    expect(planBackLabel({ loading: false, data: null }, FALLBACK)).toBe(FALLBACK);
    expect(planBackLabel({ loading: false, data: { plan: null } }, FALLBACK)).toBe(FALLBACK);
    expect(planBackLabel({ loading: false, error: new Error("boom") }, FALLBACK)).toBe(FALLBACK);
  });
});
