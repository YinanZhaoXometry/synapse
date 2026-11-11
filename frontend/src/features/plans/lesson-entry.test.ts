/**
 * The lesson-entry pure helpers (epic-36 T2): the node's one lesson
 * derivation off the plan materials read (origin=generated ∧ pinned to the
 * node — the server's per-node singleton, mirrored client-side for the
 * 「打开讲义」 deformation), and the cost hint composition — the estimate
 * function's numbers + today's remaining cap, never hand-written figures
 * (FR-16's discipline: decide with the numbers in front of you).
 */
import { describe, expect, it } from "vitest";
import { translations } from "@/contexts/i18n-dictionary";
import type { AiUsageTodayView } from "@/api/queries/settings-queries";
import type { LessonEstimateView } from "@/api/queries/lesson-queries";
import type { MaterialView } from "@/api/views";
import { lessonEntryHint, nodeLessonMaterial } from "./lesson-entry";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string, vars?: Record<string, string | number>) => {
  const raw = zhDict[key] ?? key;
  return vars
    ? Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), raw)
    : raw;
};

const material = (overrides: Partial<MaterialView> & { id: string }): MaterialView => ({
  title: `材料 ${overrides.id}`,
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [{ id: `${overrides.id}-sec-1`, title: "第一节", text: "内容" }],
  createdAt: "2026-11-12T00:00:00Z",
  downloadUrl: null,
  origin: "uploaded",
  generation: null,
  ...overrides,
});

describe("nodeLessonMaterial", () => {
  it("finds the node's generated lesson (origin=generated ∧ nodeId pinned)", () => {
    const lesson = material({ id: "lesson-1", origin: "generated", nodeId: "n-1", attachmentScope: "node" });
    const materials = [material({ id: "m-1" }), lesson];
    expect(nodeLessonMaterial(materials, "n-1")?.id).toBe("lesson-1");
  });

  it("returns null for an unpinned generated row, an uploaded pin, or no materials", () => {
    const lessonOtherNode = material({ id: "lesson-2", origin: "generated", nodeId: "n-2", attachmentScope: "node" });
    const uploadedPinned = material({ id: "m-2", nodeId: "n-1", attachmentScope: "node" });
    expect(nodeLessonMaterial([lessonOtherNode, uploadedPinned], "n-1")).toBeNull();
    expect(nodeLessonMaterial(undefined, "n-1")).toBeNull();
  });

  it("returns the FIRST match when several ride one node (the server singleton keeps it at one)", () => {
    const a = material({ id: "lesson-a", origin: "generated", nodeId: "n-1", attachmentScope: "node" });
    const b = material({ id: "lesson-b", origin: "generated", nodeId: "n-1", attachmentScope: "node" });
    expect(nodeLessonMaterial([a, b], "n-1")?.id).toBe("lesson-a");
  });
});

describe("lessonEntryHint", () => {
  const estimate = (): LessonEstimateView => ({
    outlineCalls: 1,
    sectionsMin: 4,
    sectionsMax: 6,
    totalMin: 5,
    totalMax: 7,
  });
  const usage = (callsToday: number): AiUsageTodayView => ({ callsToday, dailyLimit: 50 });

  it("composes the estimate band + today's remaining cap — the two numbers in front of the user", () => {
    expect(lessonEntryHint(estimate(), usage(7), zh)).toBe(
      zhDict["plans.nodeLessonHint"]
        .replace("{min}", "5")
        .replace("{max}", "7")
        .replace("{r}", "43"),
    );
  });

  it("floors the remaining at 0 (an over-drawn counter never renders negative)", () => {
    expect(lessonEntryHint(estimate(), usage(52), zh)).toContain("0");
  });

  it("renders nothing while either read is in flight (no guessed numbers)", () => {
    expect(lessonEntryHint(undefined, usage(7), zh)).toBeNull();
    expect(lessonEntryHint(estimate(), undefined, zh)).toBeNull();
  });
});
