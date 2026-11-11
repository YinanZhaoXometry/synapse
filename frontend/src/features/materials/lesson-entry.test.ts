/**
 * The materials-hub lesson-entry pure helpers (epic-36 T3): the per-source-
 * material singleton derivation, the row-action gate (parsed ∧ sections
 * present), and the lesson row's generation-state chip derivation. Pure so
 * the hub stays presentational; wire truth only.
 */
import { describe, expect, it } from "vitest";
import type { MaterialView } from "@/api/views";
import {
  lessonGateReason,
  lessonRowState,
  materialLessonMaterial,
} from "./lesson-entry";

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

const generation = (overrides: Partial<NonNullable<MaterialView["generation"]>> = {}) => ({
  variant: "material" as const,
  sourceMaterialIds: ["m-1"],
  outline: [
    { id: "ch-1", title: "第一章", anchors: [{ materialId: "m-1", sectionId: "m-1-sec-1" }], status: "ready" as const },
    { id: "ch-2", title: "第二章", anchors: [{ materialId: "m-1", sectionId: "m-1-sec-1" }], status: "pending" as const },
  ],
  pausedKind: null,
  generatedAt: "2026-11-12T00:00:00Z",
  ...overrides,
});

describe("materialLessonMaterial (the per-source-material singleton)", () => {
  it("finds the source material's generated lesson (variant=material ∧ sourceMaterialIds carries it)", () => {
    const lesson = material({ id: "lesson-1", origin: "generated", generation: generation() });
    expect(materialLessonMaterial([material({ id: "m-1" }), lesson], "m-1")?.id).toBe("lesson-1");
  });

  it("ignores node-variant lessons even when their sources include the material", () => {
    const nodeLesson = material({
      id: "lesson-node",
      origin: "generated",
      nodeId: "n-1",
      attachmentScope: "node",
      generation: generation({ variant: "node" }),
    });
    expect(materialLessonMaterial([nodeLesson], "m-1")).toBeNull();
  });

  it("ignores uploaded rows and a lesson whose source list excludes the material", () => {
    const otherSource = material({ id: "lesson-2", origin: "generated", generation: generation({ sourceMaterialIds: ["m-9"] }) });
    const uploaded = material({ id: "m-1" });
    expect(materialLessonMaterial([otherSource, uploaded], "m-1")).toBeNull();
  });

  it("returns null without materials (never a guessed lesson)", () => {
    expect(materialLessonMaterial(undefined, "m-1")).toBeNull();
  });

  it("returns the FIRST match when several ride one source (the server singleton keeps it at one)", () => {
    const a = material({ id: "lesson-a", origin: "generated", generation: generation() });
    const b = material({ id: "lesson-b", origin: "generated", generation: generation() });
    expect(materialLessonMaterial([a, b], "m-1")?.id).toBe("lesson-a");
  });
});

describe("lessonGateReason (parsed ∧ sections present — otherwise the honest reason)", () => {
  it("passes a parsed material with sections (null = actionable)", () => {
    expect(lessonGateReason(material({ id: "m-1" }))).toBeNull();
    expect(lessonGateReason(material({ id: "m-pdf", kind: "pdf", sections: [{ id: "page-1", title: "第 1 页", text: "x" }] }))).toBeNull();
  });

  it("refuses an unparsed material (pending and parsing alike)", () => {
    expect(lessonGateReason(material({ id: "m-2", parseState: "pending" }))).toBe("parsing");
    expect(lessonGateReason(material({ id: "m-3", parseState: "parsing" }))).toBe("parsing");
  });

  it("refuses a failed parse", () => {
    expect(lessonGateReason(material({ id: "m-4", parseState: "failed", parseFailureReason: "corrupt" }))).toBe("failed");
  });

  it("refuses a parsed material with zero sections (nothing to generate from)", () => {
    expect(lessonGateReason(material({ id: "m-5", sections: [] }))).toBe("empty");
  });
});

describe("lessonRowState (the hub's generation-state chip)", () => {
  it("renders 进行中 while chapters are still owed and nothing is paused", () => {
    expect(lessonRowState(generation())).toBe("active");
    expect(lessonRowState(generation({ outline: [ { id: "ch-1", title: "一", anchors: [], status: "failed" } ] }))).toBe("active");
  });

  it("renders 已暂停可续 when pausedKind is set (cap or provider — the pause wins over the outline)", () => {
    expect(lessonRowState(generation({ pausedKind: "cap" }))).toBe("paused");
    expect(lessonRowState(generation({ pausedKind: "provider" }))).toBe("paused");
  });

  it("renders no state for a complete lesson (every chapter ready, no pause)", () => {
    expect(
      lessonRowState(
        generation({
          outline: [{ id: "ch-1", title: "一", anchors: [], status: "ready" }],
        }),
      ),
    ).toBeNull();
  });
});
