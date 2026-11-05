import { describe, expect, it } from "vitest";
import type { SectionMarkingPartsFragment } from "@/types/graphql";
import { mapSectionMarking } from "./mappers";

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
