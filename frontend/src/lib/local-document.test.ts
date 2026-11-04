import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_DOC_KEY,
  localDocumentHasData,
  readLocalDocument,
  readLocalOnboardingComplete,
  toImportDocumentInput,
  type LegacyDocument,
} from "./local-document";
import { IMPORT_DONE_KEY, importOfferDone, markImportOfferDone, shouldOfferImport } from "./import-offer";

/**
 * Ticket 03's local-document seam (AD-4/AD-15/AD-20): the full-document
 * reader for the first-login import, the offer marker, and the verbatim
 * input mapping. The document is read-only — NEVER written or deleted
 * client-side (the rollback substrate). The marker is its own key and
 * touches nothing else (the guard test forbids the legacy key and the UI
 * pref keys anywhere else).
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const EMPTY_DOC = {
  version: 1,
  onboardingComplete: false,
  plans: [],
  nodes: [],
  materials: [],
  tasks: [],
  sessions: [],
  questions: [],
  evidence: [],
  flashcards: [],
  mistakes: [],
  readingProgress: [],
  chatThreads: [],
  sectionMarkings: [],
};

function populatedDoc(): LegacyDocument {
  return {
    ...EMPTY_DOC,
    onboardingComplete: true,
    plans: [{ id: uuid(1), topic: "软工备考", goal: "考试就绪", nodeIds: [uuid(2)], materialIds: [uuid(3)], createdAt: "2026-10-01T00:00:00.000Z" }],
    nodes: [{ id: uuid(2), planId: uuid(1), taskId: null, stage: "基础", title: "绪论", order: 0 }],
    materials: [
      {
        id: uuid(3),
        title: "讲义.pdf",
        kind: "pdf",
        sizeBytes: 2048,
        planId: uuid(1),
        taskId: null,
        parseState: "parsed",
        parseFailureReason: undefined,
        sections: [{ id: "page-1", title: "第 1 页", text: "提取的文本。" }],
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    readingProgress: [
      {
        materialId: uuid(3),
        position: { locator: { kind: "pdf", page: 2 }, text: "第 2 页文本" },
        updatedAt: "2026-10-02T00:00:00.000Z",
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("readLocalDocument (the full-document reader)", () => {
  it("returns null when no legacy document exists", () => {
    expect(readLocalDocument()).toBeNull();
  });

  it("returns null when the document is corrupt JSON (never throws, never writes)", () => {
    localStorage.setItem(LOCAL_DOC_KEY, "{not json");
    expect(readLocalDocument()).toBeNull();
    expect(localStorage.getItem(LOCAL_DOC_KEY)).toBe("{not json");
  });

  it("reads the whole document verbatim (plans, nodes, materials, progress, …)", () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(populatedDoc()));

    const doc = readLocalDocument();

    expect(doc).not.toBeNull();
    expect(doc?.version).toBe(1);
    expect(doc?.plans).toHaveLength(1);
    expect(doc?.materials?.[0]?.sections?.[0]?.id).toBe("page-1");
    expect(doc?.readingProgress).toHaveLength(1);
    // the reader is read-only — the raw key is untouched
    expect(readLocalOnboardingComplete()).toBe(true);
  });

  it("never writes the legacy key", () => {
    readLocalDocument();
    expect(localStorage.getItem(LOCAL_DOC_KEY)).toBeNull();
  });
});

describe("localDocumentHasData (the offer gate)", () => {
  it("is false for an empty document", () => {
    expect(localDocumentHasData(EMPTY_DOC)).toBe(false);
  });

  it("is true when any collection holds rows", () => {
    expect(localDocumentHasData(populatedDoc())).toBe(true);
    // a partial row still counts — the gate reads lengths, not shapes (the
    // payload itself is checked on read by the mappers/server)
    const flashcardOnly = { ...EMPTY_DOC, flashcards: [{ id: uuid(9) }] } as unknown as LegacyDocument;
    const mistakeOnly = { ...EMPTY_DOC, mistakes: [{ id: uuid(9) }] } as unknown as LegacyDocument;
    expect(localDocumentHasData(flashcardOnly)).toBe(true);
    expect(localDocumentHasData(mistakeOnly)).toBe(true);
  });
});

describe("toImportDocumentInput (the verbatim mapping, AD-4)", () => {
  it("carries the document shape through: ids, sections, locators, timestamps", () => {
    const input = toImportDocumentInput(populatedDoc());

    expect(input.version).toBe(1);
    expect(input.onboardingComplete).toBe(true);
    expect(input.plans[0]).toEqual({
      id: uuid(1),
      topic: "软工备考",
      goal: "考试就绪",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    expect(input.nodes[0]).toMatchObject({ id: uuid(2), planId: uuid(1), taskId: null, order: 0 });
    expect(input.materials[0]).toMatchObject({
      id: uuid(3),
      kind: "pdf",
      sizeBytes: 2048,
      parseState: "parsed",
      sections: [{ id: "page-1", title: "第 1 页", text: "提取的文本。" }],
    });
    expect(input.readingProgress[0]).toEqual({
      materialId: uuid(3),
      position: { locator: { kind: "pdf", page: 2 }, text: "第 2 页文本" },
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(input.tasks).toEqual([]);
    expect(input.chatThreads).toEqual([]);
    expect(input.sectionMarkings).toEqual([]);
  });

  it("strips the aggregate arrays the associations realize (plan.nodeIds/materialIds)", () => {
    const input = toImportDocumentInput(populatedDoc());

    expect(input.plans[0]).not.toHaveProperty("nodeIds");
    expect(input.plans[0]).not.toHaveProperty("materialIds");
  });
});

describe("the one-time offer marker", () => {
  it("offers when the legacy document holds data and no marker is set", () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(populatedDoc()));
    expect(shouldOfferImport()).toBe(true);
  });

  it("never offers on an empty document", () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(EMPTY_DOC));
    expect(shouldOfferImport()).toBe(false);
  });

  it("never offers once the marker is set", () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(populatedDoc()));
    markImportOfferDone();
    expect(importOfferDone()).toBe(true);
    expect(shouldOfferImport()).toBe(false);
  });

  it("the marker writes ONLY its own key — never the legacy doc, never UI prefs", () => {
    markImportOfferDone();

    const keys = Object.keys(localStorage);
    expect(keys).toEqual([IMPORT_DONE_KEY]);
    expect(IMPORT_DONE_KEY).not.toBe(LOCAL_DOC_KEY);
    expect(IMPORT_DONE_KEY).not.toContain("synapse-db");
    expect(localStorage.getItem(LOCAL_DOC_KEY)).toBeNull();
  });
});
