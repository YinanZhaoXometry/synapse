import { describe, expect, it } from "vitest";
import type { ChatThread, Material } from "@/domain/entities";
import {
  citationLabel,
  companionSectionId,
  entriesFromThread,
  locatorDisplayTarget,
  replyCitationLocators,
} from "./message-shaping";

/**
 * CompanionPanel's pure half (T5): locator → chip label resolution (第 N 页 /
 * section title) and the persisted-thread → transcript mapping. Prior art:
 * reader's position-tracking selectors, display-shaping.test.ts.
 */

const material: Material = {
  id: "m1",
  title: "Lecture 4.pdf",
  kind: "pdf",
  sizeBytes: 10,
  planId: null,
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [
    { id: "page-1", title: "Page 1", text: "first page" },
    { id: "page-7", title: "12.2 集成策略", text: "integration strategy" },
    { id: "intro", title: "Introduction", text: "intro text" },
  ],
  createdAt: "2026-11-01T00:00:00Z",
};

describe("companionSectionId (the `page-N` locator scheme, entities.ts contract)", () => {
  it("pdf locators map to their page section", () => {
    expect(companionSectionId({ kind: "pdf", page: 7 })).toBe("page-7");
  });

  it("pdf pages clamp to positive integers", () => {
    expect(companionSectionId({ kind: "pdf", page: 0 })).toBe("page-1");
  });

  it("markdown locators carry their section id directly", () => {
    expect(companionSectionId({ kind: "markdown", sectionId: "intro" })).toBe("intro");
  });
});

describe("citationLabel (CitationChip 第 N 页 / section title, UX CitationChip)", () => {
  it("a pdf locator resolves its page number and the page section's title", () => {
    expect(citationLabel(material, { kind: "pdf", page: 7 })).toEqual({
      page: 7,
      title: "12.2 集成策略",
    });
  });

  it("a markdown locator resolves the section title, no page", () => {
    expect(citationLabel(material, { kind: "markdown", sectionId: "intro" })).toEqual({
      page: null,
      title: "Introduction",
    });
  });

  it("an unknown section id resolves title null honestly — never an invented name", () => {
    expect(citationLabel(material, { kind: "markdown", sectionId: "gone" })).toEqual({
      page: null,
      title: null,
    });
    expect(citationLabel(material, { kind: "pdf", page: 99 })).toEqual({ page: 99, title: null });
  });

  it("null material still yields the page number, title null", () => {
    expect(citationLabel(null, { kind: "pdf", page: 3 })).toEqual({ page: 3, title: null });
  });
});

describe("locatorDisplayTarget (grounded badge / streaming line target)", () => {
  it("a pdf locator names its page; the caller formats it (i18n stays out of the pure module)", () => {
    expect(locatorDisplayTarget(material, { kind: "pdf", page: 7 })).toEqual({
      page: 7,
      text: "7",
    });
  });

  it("a markdown locator names its section title", () => {
    expect(locatorDisplayTarget(material, { kind: "markdown", sectionId: "intro" })).toEqual({
      page: null,
      text: "Introduction",
    });
  });

  it("an unresolvable locator falls back to the raw section id — honest, never invented", () => {
    expect(locatorDisplayTarget(material, { kind: "markdown", sectionId: "gone" })).toEqual({
      page: null,
      text: "gone",
    });
  });
});

describe("entriesFromThread (restore path, AD-3/4)", () => {
  it("an absent thread shapes to an empty transcript", () => {
    expect(entriesFromThread(undefined)).toEqual([]);
  });

  it("an empty thread shapes to an empty transcript", () => {
    const thread: ChatThread = { materialId: "m1", planId: null, messages: [], updatedAt: "2026-11-03T00:00:00Z" };
    expect(entriesFromThread(thread)).toEqual([]);
  });

  it("messages shape in order with citations carried; the reply contract is NOT restored", () => {
    const thread: ChatThread = {
      materialId: "m1",
      planId: null,
      messages: [
        {
          id: "u1",
          role: "user",
          text: "为什么集成测试要先验证接口契约？",
          citations: [],
          createdAt: "2026-11-03T10:00:00Z",
        },
        {
          id: "c1",
          role: "companion",
          text: "先往这个方向想……",
          citations: [{ kind: "pdf", page: 7 }],
          createdAt: "2026-11-03T10:00:05Z",
        },
      ],
      updatedAt: "2026-11-03T10:00:05Z",
    };
    const entries = entriesFromThread(thread);
    expect(entries.map((e) => e.role)).toEqual(["user", "companion"]);
    expect(entries[1].citations).toEqual([{ kind: "pdf", page: 7 }]);
    // The reply contract (rung/intent) is runtime-only — restored rows render
    // as plain cited bubbles, never a guessed posture.
    expect(entries[1].reply).toBeNull();
    expect(entries[1].request).toBeNull();
    expect(entries[1].failed).toBe(false);
  });
});

describe("replyCitationLocators (what a ChatMessage stores)", () => {
  it("maps the reply's citations to bare locators, in order", () => {
    const reply = {
      intent: "explain" as const,
      rung: "hint" as const,
      text: "…",
      citations: [
        { locator: { kind: "pdf", page: 7 } as const, quote: "a" },
        { locator: { kind: "pdf", page: 8 } as const, quote: "b" },
      ],
      canEscalate: true,
      language: "zh" as const,
    };
    expect(replyCitationLocators(reply)).toEqual([{ kind: "pdf", page: 7 }, { kind: "pdf", page: 8 }]);
  });
});
