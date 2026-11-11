import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import { NodeStateBadge } from "./node-state-badge";
import {
  NODE_STATE_DISPLAY,
  nodeJumpTargets,
  nodePrimaryAction,
  nodeQuickTestHref,
} from "./node-state";

/**
 * The node-state display contract (epic P2-10 T3, FR-6/7) — ONE contract for
 * every node-shaped surface: the PlanHome tree row today, the roadmap graph
 * node (T4) next. Pinned here: the three-state vocabulary (SERVER words, AD-14)
 * is never color-only (AD-9 — distinct glyph AND text label AND aria-label per
 * state), and the click-through builds its destinations through the REAL anchor
 * channel (AD-8) / the node Quick Test route.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const mapping = (overrides: Partial<MaterialNodeMappingView>): MaterialNodeMappingView => ({
  id: "row",
  materialId: "m-md",
  nodeId: "n-1",
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "confirmed",
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const material = (overrides: Partial<MaterialView>): MaterialView => ({
  id: "m-md",
  title: "Distributed systems notes",
  kind: "markdown",
  sizeBytes: 1,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: undefined,
  sections: [
    { id: "sec-1", title: "Raft", text: "leader election" },
    { id: "sec-2", title: "Chains", text: "chain replication" },
  ],
  createdAt: "2026-11-05T00:00:00Z",
  downloadUrl: null,
  origin: "uploaded",
  generation: null,
  ...overrides,
});

describe("the state contract (AD-9: never color-only)", () => {
  const states = ["mastered", "partial", "uncovered"] as const;

  it("carries a distinct glyph, label key, and tint class per state", () => {
    const glyphs = new Set(states.map((s) => NODE_STATE_DISPLAY[s].glyph));
    const labels = new Set(states.map((s) => NODE_STATE_DISPLAY[s].labelKey));
    const tints = new Set(states.map((s) => NODE_STATE_DISPLAY[s].tintClass));
    expect(glyphs.size).toBe(3);
    expect(labels.size).toBe(3);
    expect(tints.size).toBe(3);
    // The vocabulary matches the server's exactly (AD-14).
    expect(states).toEqual(["mastered", "partial", "uncovered"]);
  });

  it.each(states)("renders $state as glyph + text label with a distinct aria-label", (state) => {
    render(
      <LanguageProvider>
        <NodeStateBadge state={state} />
      </LanguageProvider>,
    );
    const badge = screen.getByTestId("node-state-badge");
    expect(badge).toHaveTextContent(NODE_STATE_DISPLAY[state].glyph);
    expect(badge).toHaveTextContent(zhDict[NODE_STATE_DISPLAY[state].labelKey]);
    expect(badge).toHaveAttribute("data-state", state);
    // aria-label names the state — distinct across the three states.
    expect(badge).toHaveAttribute("aria-label", expect.stringContaining(zhDict[NODE_STATE_DISPLAY[state].labelKey]));
  });

  it("announces three DISTINCT aria-labels (not one shared name)", () => {
    const labels = states.map((state) => {
      const { unmount } = render(
        <LanguageProvider>
          <NodeStateBadge state={state} />
        </LanguageProvider>,
      );
      const aria = screen.getByTestId("node-state-badge").getAttribute("aria-label");
      unmount();
      return aria;
    });
    expect(new Set(labels).size).toBe(3);
  });
});

describe("nodeJumpTargets (the click-through's reader half, AD-8)", () => {
  it("builds the markdown anchor href through the reader section channel", () => {
    const targets = nodeJumpTargets([mapping({})], [material({})]);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      materialId: "m-md",
      sectionId: "sec-1",
      title: "Raft",
      // The REAL builder's output shape: reader route + hl flash + section hash.
      href: "/read/m-md?hl=1#sec-1",
    });
  });

  it("builds the pdf anchor from the page-N section convention", () => {
    const targets = nodeJumpTargets(
      [mapping({ materialId: "m-pdf", sectionId: "page-2" })],
      [material({ id: "m-pdf", kind: "pdf", sections: [{ id: "page-2", title: "Page 2", text: "..." }] })],
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].href).toBe("/read/m-pdf?page=2&hl=1");
    expect(targets[0].title).toBe("Page 2");
  });

  it("keeps only CONFIRMED rows mapping a section of a PARSED material", () => {
    const materials = [
      material({}),
      material({ id: "m-pending", parseState: "pending", sections: [] }),
      material({ id: "m-pdf", kind: "pdf", sections: [{ id: "page-2", title: "Page 2", text: "..." }] }),
    ];
    const targets = nodeJumpTargets(
      [
        mapping({ id: "proposed", sectionId: "sec-2", status: "proposed" }),
        mapping({ id: "rejected", sectionId: "sec-2", status: "rejected" }),
        mapping({ id: "unparsed", materialId: "m-pending" }),
        // Slug drift: the section id no longer exists in the parsed extraction
        // (latestReading's stale-row precedent — never promise a dead anchor).
        mapping({ id: "drifted", sectionId: "sec-gone" }),
        // A pdf section id off the page-N convention cannot build an honest anchor.
        mapping({ id: "off-convention", materialId: "m-pdf", sectionId: "weird" }),
        mapping({ id: "kept-md", sectionId: "sec-2" }),
        mapping({ id: "kept-pdf", materialId: "m-pdf", sectionId: "page-2" }),
      ],
      materials,
    );
    expect(targets.map((t) => t.sectionId)).toEqual(["sec-2", "page-2"]);
    expect(targets.map((t) => t.materialId)).toEqual(["m-md", "m-pdf"]);
  });

  it("falls back to the section id when the title is blank (a bare heading has none)", () => {
    const targets = nodeJumpTargets(
      [mapping({})],
      [material({ sections: [{ id: "sec-1", title: "", text: "..." }] })],
    );
    expect(targets[0].title).toBeNull();
  });
});

describe("nodeQuickTestHref + nodePrimaryAction (the click-through's quiz half)", () => {
  it("routes the node Quick Test into the plan flow with the nodeId param", () => {
    expect(nodeQuickTestHref("plan-1", "n-1")).toBe("/plan/plan-1/quiz?nodeId=n-1");
  });

  it("prefers study when a confirmed mapping resolves (multiple targets ride along)", () => {
    const targets = nodeJumpTargets(
      [mapping({ sectionId: "sec-1" }), mapping({ id: "row-2", sectionId: "sec-2" })],
      [material({})],
    );
    const action = nodePrimaryAction(targets, "plan-1", "n-1");
    expect(action.kind).toBe("study");
    expect(action.kind === "study" && action.targets).toHaveLength(2);
  });

  it("falls back to the node Quick Test when no confirmed mapping resolves", () => {
    const action = nodePrimaryAction([], "plan-1", "n-1");
    expect(action).toEqual({ kind: "quiz", href: "/plan/plan-1/quiz?nodeId=n-1" });
  });
});

describe("node-state i18n namespace", () => {
  const enDict = (translations as Record<string, Record<string, string>>).en;
  const keys = [
    "plans.nodeStateAria",
    "plans.nodeStudyAction",
    "plans.nodeStudyAria",
    "plans.nodeJumpMenuLabel",
    "plans.nodeJumpMenuAria",
    "plans.nodeQuickTest",
    "plans.nodeQuickTestAria",
    "plans.nodeTeachAction",
    "plans.nodeTeachAria",
    "plans.nodeTeachPrefill",
    "companion.teachBadge",
    "quiz.nodeContext",
    "quiz.nodeContextNote",
  ];

  it("exists in BOTH languages", () => {
    for (const key of keys) {
      expect(zhDict[key], `zh missing ${key}`).toBeTruthy();
      expect(enDict[key], `en missing ${key}`).toBeTruthy();
    }
  });

  it("epic-34 T2: the retired ask-AI keys are gone (the node-level 问 AI 导师 is retired)", () => {
    for (const key of [ "plans.askAiAction", "plans.askAiAria", "plans.companionAskDraft" ]) {
      expect(zhDict[key], `zh still carries retired ${key}`).toBeUndefined();
      expect(enDict[key], `en still carries retired ${key}`).toBeUndefined();
    }
  });
});
