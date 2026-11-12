import { describe, expect, it } from "vitest";
import type { SectionMarkingPartsFragment } from "@/types/graphql";
import { mapMaterial, mapMaterialSummary, mapSectionMarking } from "./mappers";

/**
 * The FR-15 mapper contract (epic-15 T2): a claim row maps verbatim —
 * DateTimes ride as plain strings (the codegen scalar config), `clearedAt`
 * stays exactly null while the claim is open (the open-claim derivation is
 * the consumer's `clearedAt == null` — rows are history, never defaulted),
 * and the server's newest-first order is never re-sorted anywhere in the seam.
 */

const row = (overrides: Partial<SectionMarkingPartsFragment> = {}): SectionMarkingPartsFragment => ({
  id: "sm-1",
  materialId: "mat-1",
  sectionId: "sec-intro",
  claimedAt: "2026-11-06T10:00:00Z",
  clearedAt: null,
  ...overrides,
});

describe("mapSectionMarking", () => {
  it("maps an open claim verbatim: clearedAt stays null — the client's open-claim key", () => {
    expect(mapSectionMarking(row())).toEqual({
      id: "sm-1",
      materialId: "mat-1",
      sectionId: "sec-intro",
      claimedAt: "2026-11-06T10:00:00Z",
      clearedAt: null,
    });
  });

  it("maps a cleared row: clearedAt rides as the server string, claimedAt stands", () => {
    const view = mapSectionMarking(row({ id: "sm-2", clearedAt: "2026-11-06T12:30:00Z" }));
    expect(view.claimedAt).toBe("2026-11-06T10:00:00Z");
    expect(view.clearedAt).toBe("2026-11-06T12:30:00Z");
  });

  it("passes DateTimes through as plain strings verbatim — never re-formatted", () => {
    const view = mapSectionMarking(
      row({ claimedAt: "2026-01-02T03:04:05.678Z", clearedAt: "2026-02-03T04:05:06Z" }),
    );
    expect(typeof view.claimedAt).toBe("string");
    expect(typeof view.clearedAt).toBe("string");
    expect(view.claimedAt).toBe("2026-01-02T03:04:05.678Z");
    expect(view.clearedAt).toBe("2026-02-03T04:05:06Z");
  });

  it("maps rows in place — the server's newest-first order is kept, no client re-sort", () => {
    const serverOrder = [
      row({ id: "sm-new", claimedAt: "2026-11-06T09:00:00Z" }),
      row({ id: "sm-mid", claimedAt: "2026-11-05T09:00:00Z", clearedAt: "2026-11-05T10:00:00Z" }),
      row({ id: "sm-old", claimedAt: "2026-11-04T09:00:00Z", clearedAt: "2026-11-04T10:00:00Z" }),
    ];
    expect(serverOrder.map(mapSectionMarking).map((v) => v.id)).toEqual(["sm-new", "sm-mid", "sm-old"]);
  });
});

// ── epic-36: the origin/generation axis (AI 讲义) ────────────────────────────

/**
 * The lesson mapper contract (epic-36 T2): origin rides the closed
 * uploaded|generated union (unknown → throw loud — the honest-mapper law),
 * the generation jsonb shapes into the strict view (pausedKind's
 * cap|provider|null union rebuilt, outline chapters carried verbatim in
 * server order), and uploads keep `generation: null`. Wire fixtures ride
 * the fragment shapes loosely — the payload structure is checked here, by
 * the mapper, never by the fixture types.
 */

const uploadedWire = {
  id: "mat-1",
  title: "复习讲义.md",
  kind: "markdown",
  sizeBytes: 100,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  sections: [{ id: "sec-1", title: "S", text: "body" }],
  createdAt: "2026-11-12T00:00:00Z",
  downloadUrl: null,
  origin: "uploaded",
  generation: null,
};

const generationWire = {
  variant: "node",
  sourceMaterialIds: ["src-1"],
  outline: [
    {
      id: "ch-1",
      title: "选举与日志",
      anchors: [{ materialId: "src-1", sectionId: "sec-1" }],
      status: "ready",
    },
    {
      id: "ch-2",
      title: "链式复制",
      anchors: [{ materialId: "src-1", sectionId: "sec-2" }],
      status: "pending",
    },
  ],
  pausedKind: "cap",
  generatedAt: "2026-11-12T01:02:03Z",
};

describe("mapMaterial — the origin/generation axis (epic-36)", () => {
  it("maps an uploaded material: origin verbatim, generation null", () => {
    const view = mapMaterial(uploadedWire as never);
    expect(view.origin).toBe("uploaded");
    expect(view.generation).toBeNull();
  });

  it("maps a lesson's generation jsonb into the strict view (outline order + anchors carried)", () => {
    const view = mapMaterial({ ...uploadedWire, origin: "generated", generation: generationWire } as never);
    expect(view.origin).toBe("generated");
    expect(view.generation).toEqual({
      variant: "node",
      sourceMaterialIds: ["src-1"],
      outline: [
        { id: "ch-1", title: "选举与日志", anchors: [{ materialId: "src-1", sectionId: "sec-1" }], status: "ready" },
        { id: "ch-2", title: "链式复制", anchors: [{ materialId: "src-1", sectionId: "sec-2" }], status: "pending" },
      ],
      pausedKind: "cap",
      generatedAt: "2026-11-12T01:02:03Z",
    });
  });

  it("maps a null pausedKind honestly — never a defaulted pause", () => {
    const view = mapMaterial({
      ...uploadedWire,
      origin: "generated",
      generation: { ...generationWire, pausedKind: null },
    } as never);
    expect(view.generation?.pausedKind).toBeNull();
  });

  it("throws loud on an unknown origin (contract break, not a default)", () => {
    expect(() => mapMaterial({ ...uploadedWire, origin: "cloned" } as never)).toThrow(/unknown material origin/);
  });

  it("throws loud on an unknown pausedKind or outline status (the union law)", () => {
    expect(() =>
      mapMaterial({ ...uploadedWire, origin: "generated", generation: { ...generationWire, pausedKind: "budget" } } as never),
    ).toThrow(/unknown lesson pausedKind/);
    expect(() =>
      mapMaterial({
        ...uploadedWire,
        origin: "generated",
        generation: { ...generationWire, outline: [{ ...generationWire.outline[0], status: "half" }] },
      } as never),
    ).toThrow(/unknown lesson outline status/);
  });

  it("mapMaterialSummary carries origin + generation identically (the list rows render the chip)", () => {
    const { sections: _sections, ...summaryWire } = uploadedWire;
    const view = mapMaterialSummary(summaryWire as never);
    expect(view.origin).toBe("uploaded");
    expect(view.generation).toBeNull();

    const lesson = mapMaterialSummary({
      ...summaryWire,
      origin: "generated",
      generation: generationWire,
    } as never);
    expect(lesson.origin).toBe("generated");
    expect(lesson.generation?.outline).toHaveLength(2);
    expect(lesson.generation?.pausedKind).toBe("cap");
  });
});
