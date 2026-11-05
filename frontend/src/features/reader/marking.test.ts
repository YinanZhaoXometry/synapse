/**
 * The Mastery Marking pure logic (FR-15, epic-15 T3): the open-claim
 * derivation the reader's green state rides, and the confirm-quiz launcher's
 * dispatch payload. The read returns HISTORY (open + cleared rows, newest
 * first; unmark sets clearedAt, never deletes) — the open claims are derived
 * here, defensively taking the FIRST open row per section even though the
 * server's claim law keeps at most one open row per section.
 */
import { describe, expect, it } from "vitest";
import type { SectionMarkingView } from "@/api/views";
import { quickTestSectionId } from "./quick-test-gate";
import { markingQuickTestScope, openClaimsBySection } from "./marking";

const row = (id: string, sectionId: string, clearedAt: string | null, claimedAt = "2026-11-06T10:00:00Z"): SectionMarkingView => ({
  id,
  materialId: "mat-1",
  sectionId,
  claimedAt,
  clearedAt,
});

describe("openClaimsBySection (epic-15 T3)", () => {
  it("derives the open claim per section from clearedAt == null", () => {
    const open = openClaimsBySection([row("r1", "intro", null), row("r2", "page-2", null)]);

    expect(open.size).toBe(2);
    expect(open.get("intro")?.id).toBe("r1");
    expect(open.get("page-2")?.id).toBe("r2");
  });

  it("ignores cleared rows — an unmarked section derives no green", () => {
    const open = openClaimsBySection([
      row("r1", "intro", "2026-11-06T11:00:00Z"),
      row("r2", "page-2", null),
    ]);

    expect(open.size).toBe(1);
    expect(open.has("intro")).toBe(false);
    expect(open.get("page-2")?.id).toBe("r2");
  });

  it("keeps a re-claimed section open when a cleared predecessor row exists (rows are history)", () => {
    // claim → unmark → re-claim: the older row is cleared, the newer open.
    const open = openClaimsBySection([
      row("r2", "intro", null, "2026-11-06T12:00:00Z"),
      row("r1", "intro", "2026-11-06T11:00:00Z"),
    ]);

    expect(open.size).toBe(1);
    expect(open.get("intro")?.id).toBe("r2");
  });

  it("takes the FIRST open row per section when duplicates sneak in (defensive — the claim law makes them impossible)", () => {
    const open = openClaimsBySection([
      row("r1", "intro", null, "2026-11-06T10:00:00Z"),
      row("r2", "intro", null, "2026-11-06T11:00:00Z"),
    ]);

    expect(open.size).toBe(1);
    expect(open.get("intro")?.id).toBe("r1");
  });

  it("returns an empty map for undefined (the read has not landed) and for no rows", () => {
    expect(openClaimsBySection(undefined).size).toBe(0);
    expect(openClaimsBySection([]).size).toBe(0);
  });
});

describe("markingQuickTestScope (the confirm-quiz launcher's payload)", () => {
  it("scopes a markdown section by its slug", () => {
    expect(markingQuickTestScope("mat-1", "getting-started")).toEqual({
      materialId: "mat-1",
      selection: { kind: "markdown", sectionId: "getting-started", text: "" },
    });
  });

  it("scopes a PDF section (the page-N convention) as the pdf selection", () => {
    expect(markingQuickTestScope("mat-1", "page-3")).toEqual({
      materialId: "mat-1",
      selection: { kind: "pdf", page: 3, text: "" },
    });
  });

  it("round-trips both shapes back to the same section id through the seam (quickTestSectionId)", () => {
    expect(quickTestSectionId(markingQuickTestScope("mat-1", "getting-started").selection)).toBe("getting-started");
    expect(quickTestSectionId(markingQuickTestScope("mat-1", "page-3").selection)).toBe("page-3");
  });
});
