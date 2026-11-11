import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { Toaster } from "@/components/ui/sonner";
import { GenerateNoteDocument, PlanNotesDocument } from "@/types/graphql";
import type { KnowledgeNodeView, MaterialView, NoteView } from "@/api/views";
import NotesSection from "./NotesSection";
import { splitNoteBody } from "./note-body-shaping";

/**
 * NotesSection (epic P2-12 T1; FR-40; delta decision 3 — component render
 * seam, MaterialCoveragePanel.test.tsx precedent; epic-35 T02 reshaped the
 * rows): the plan's notes render from fixture views (title, scope chip, the
 * scope's resolved target, a scanning excerpt) as LINKS into the standalone
 * reading page — the body itself never renders in the rail (NotePage.test
 * owns the body assertions) — the generate flow rides the mutation with the
 * EXACT scope input the picker built (plan | node | material + the optional
 * enrichAt annotation), export downloads valid markdown containing the
 * markers verbatim (the payload captured through a stubbed Blob; the anchor
 * click jsdom-pinned), and the notes namespace exists in BOTH dictionary
 * languages (independent source, never recomputed).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const NODES: KnowledgeNodeView[] = [
  { id: "n-1", planId: "plan-1", taskId: null, stage: null, title: "Consensus", order: 0, description: null, optional: false, studyMark: null, masteryScore: "0", state: "uncovered" },
  { id: "n-2", planId: "plan-1", taskId: null, stage: null, title: "Replication", order: 1, description: null, optional: false, studyMark: null, masteryScore: "40", state: "partial" },
];

const MATERIAL: MaterialView = {
  id: "m-1",
  title: "Distributed systems notes",
  kind: "markdown",
  sizeBytes: 1234,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: undefined,
  sections: [{ id: "sec-1", title: "Raft", text: "" }],
  createdAt: "2026-11-05T00:00:00Z",
  downloadUrl: null,
};

const MATERIALS = [ MATERIAL ];

const NOTE_BODY = [
  "# Raft in one note",
  "",
  "Raft elects a leader and replicates the log.",
  "",
  "[[enrich|diagram|Raft leader election across three nodes]]",
  "",
  "Failure detection rides the heartbeat.",
  "",
  "[[enrich|chart|failure detection latency comparison]]",
  "",
  "[[enrich|user|a timeline of the consensus rounds]]",
].join("\n");

const note = (overrides: Partial<NoteView> & { id: string }): NoteView => ({
  title: "Raft in one note",
  body: NOTE_BODY,
  scope: "plan",
  scopeId: "plan-1",
  enrichment: [],
  targeting: [],
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

const NOTE_PLAN = note({ id: "note-1", scope: "plan", scopeId: "plan-1" });
const NOTE_NODE = note({ id: "note-2", scope: "node", scopeId: "n-1" });
const NOTE_MATERIAL = note({ id: "note-3", scope: "material", scopeId: "m-1" });

/** Wire-shaped fixture rows: the cache write needs __typename (Apollo normalization). */
const wire = (n: NoteView) => ({
  ...n,
  enrichment: n.enrichment.map((marker) => ({ ...marker, __typename: "NoteMarker" })),
  __typename: "Note",
});
const wiredNotes = () => [ NOTE_PLAN, NOTE_NODE, NOTE_MATERIAL ].map(wire);

const notesMock = {
  request: { query: PlanNotesDocument, variables: { planId: "plan-1" } },
  result: { data: { notes: wiredNotes() } },
};

function mount(mocks: MockedResponse[] = [ notesMock ]) {
  return render(
    <MockedProvider mocks={mocks}>
      <LanguageProvider>
        <MemoryRouter>
          <NotesSection planId="plan-1" nodes={NODES} materials={MATERIALS} />
        </MemoryRouter>
        <Toaster />
      </LanguageProvider>
    </MockedProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotesSection (delta decision 3 — plan-scoped; epic-35 T02: rows link to the reading page)", () => {
  it("renders the plan's notes — title, scope chip, and the scope's resolved target", async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId("note-row")).toHaveLength(3));
    expect(screen.getAllByText("Raft in one note")).toHaveLength(3);
    expect(screen.getByText(zh("notes.chipPlan"))).toBeTruthy();
    // node/material notes resolve their target's title (never a raw uuid)
    expect(screen.getByText("Consensus")).toBeTruthy();
    expect(screen.getByText("Distributed systems notes")).toBeTruthy();
  });

  it("links every row to the standalone reading page — the body never renders in the rail", async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId("note-row")).toHaveLength(3));

    const links = screen.getAllByTestId("note-row-link");
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toBe("/plan/plan-1/notes/note-1");
    expect(links[1].getAttribute("href")).toBe("/plan/plan-1/notes/note-2");
    expect(links[2].getAttribute("href")).toBe("/plan/plan-1/notes/note-3");

    // the body itself stays off the rail (the reading page owns it)
    expect(screen.queryByTestId("note-body")).toBeNull();
    // …but a scanning excerpt rides the row (markers stripped)
    expect(screen.getAllByText(/Raft elects a leader and replicates the log/).length).toBe(3);
  });

  it("generates with the scope picker's exact input — whole plan", async () => {
    // MockedProvider variables as a FUNCTION: captures the exact input the
    // section built (the client uuid is minted at the call site — asserted
    // uuid-SHAPED, never a frozen literal).
    let capturedInput: Record<string, unknown> | null = null;
    const generateMock = {
      request: {
        query: GenerateNoteDocument,
        variables: (vars: { input: Record<string, unknown> }) => {
          capturedInput = vars.input;
          return (
            vars.input.scope === "plan" &&
            vars.input.planId === "plan-1" &&
            vars.input.nodeId === null &&
            vars.input.materialId === null &&
            vars.input.enrichAt === null &&
            typeof vars.input.clientUuid === "string" &&
            String(vars.input.clientUuid).match(/^[0-9a-f-]{36}$/) !== null
          );
        },
      },
      result: { data: { generateNote: { note: wire(NOTE_PLAN) } } },
    };
    mount([ notesMock, generateMock ]);

    fireEvent.click(screen.getByTestId("notes-generate-run"));
    expect(await screen.findByText(zh("notes.done"))).toBeInTheDocument();
    expect(capturedInput).toMatchObject({ scope: "plan", language: "zh", planId: "plan-1", nodeId: null, materialId: null, enrichAt: null });
  });

  it("generates node-scoped with the picker's node id and the enrichAt annotation", async () => {
    let capturedInput: Record<string, unknown> | null = null;
    const generateMock = {
      request: {
        query: GenerateNoteDocument,
        variables: (vars: { input: Record<string, unknown> }) => {
          capturedInput = vars.input;
          return vars.input.scope === "node" && vars.input.nodeId === "n-2" && vars.input.enrichAt === "在选举部分加一张时序图";
        },
      },
      result: { data: { generateNote: { note: wire(NOTE_NODE) } } },
    };
    mount([ notesMock, generateMock ]);

    fireEvent.click(screen.getByTestId("notes-scope-node"));
    fireEvent.change(screen.getByTestId("notes-node-picker"), { target: { value: "n-2" } });
    fireEvent.change(screen.getByTestId("notes-enrich-input"), { target: { value: "在选举部分加一张时序图" } });
    fireEvent.click(screen.getByTestId("notes-generate-run"));
    expect(await screen.findByText(zh("notes.done"))).toBeInTheDocument();
    expect(capturedInput).toMatchObject({ scope: "node", language: "zh", planId: null, nodeId: "n-2", materialId: null, enrichAt: "在选举部分加一张时序图" });
  });

  it("keeps the generate action honest — node scope without a selection cannot run", () => {
    mount([ notesMock ]);
    fireEvent.click(screen.getByTestId("notes-scope-node"));
    const run = screen.getByTestId("notes-generate-run");
    expect(run.getAttribute("disabled")).not.toBeNull();

    fireEvent.change(screen.getByTestId("notes-node-picker"), { target: { value: "n-1" } });
    expect(run.getAttribute("disabled")).toBeNull();
  });

  it("exports the note as markdown carrying the markers verbatim (stubbed Blob, jsdom-pinned anchor click)", async () => {
    const payloads: string[] = [];
    // jsdom 20 has no Blob.text() and no URL.createObjectURL — the payload is
    // captured through a stubbed Blob constructor and the download through
    // the pinned anchor click.
    vi.stubGlobal("Blob", class {
      parts: BlobPart[];
      constructor(parts: BlobPart[]) {
        this.parts = parts;
        payloads.push(parts.join(""));
      }
    });
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:mock-url";
    URL.revokeObjectURL = () => {};
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      mount();
      await waitFor(() => expect(screen.getAllByTestId("note-row")).toHaveLength(3));
      fireEvent.click(screen.getAllByTestId("note-export")[0]);

      await waitFor(() => expect(payloads).toHaveLength(1));
      const text = payloads[0];
      expect(text).toContain("# Raft in one note");
      for (const token of splitNoteBody(NOTE_BODY)) {
        if (token.kind === "marker") expect(text).toContain(`[[enrich|${token.markerKind}|${token.suggestion}]]`);
      }
      expect(clickSpy).toHaveBeenCalledTimes(1); // the download anchor's click
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("keeps the notes namespace bilingual — every key exists in BOTH dictionaries", () => {
    const enDict = (translations as Record<string, Record<string, string>>).en;
    const usedKeys = Object.keys(zhDict).filter((key) => key.startsWith("notes."));
    expect(usedKeys.length).toBeGreaterThan(20);
    for (const key of usedKeys) {
      expect(enDict[key]).toBeTruthy();
    }
  });
});

describe("NotesSection weak-spot targeting (FR-22, epic P2-12 T2)", () => {
  it("enables the 薄弱点加强 toggle only on the plan scope and hints otherwise", () => {
    mount();
    const toggle = screen.getByTestId("notes-targeting-toggle");
    expect(toggle.getAttribute("disabled")).toBeNull();
    expect(screen.queryByTestId("notes-targeting-hint")).toBeNull();

    fireEvent.click(screen.getByTestId("notes-scope-node"));
    expect(toggle.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByTestId("notes-targeting-hint").textContent).toBe(zh("notes.targetingHint"));

    fireEvent.click(screen.getByTestId("notes-scope-plan"));
    expect(toggle.getAttribute("disabled")).toBeNull();
    expect(screen.queryByTestId("notes-targeting-hint")).toBeNull();
  });

  it("passes targeting { mode: weakSpot } only when the toggle is on — null otherwise (plan scope)", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const generateMock = {
      request: {
        query: GenerateNoteDocument,
        variables: (vars: { input: Record<string, unknown> }) => {
          captured.push(vars.input);
          return vars.input.scope === "plan" && vars.input.planId === "plan-1";
        },
      },
      result: { data: { generateNote: { note: wire(NOTE_PLAN) } } },
    };
    // the same mutation fires twice — MockedProvider mocks are single-use,
    // so the (identical) generate mock rides twice.
    mount([ notesMock, generateMock, generateMock ]);

    fireEvent.click(screen.getByTestId("notes-generate-run"));
    expect(await screen.findByText(zh("notes.done"))).toBeInTheDocument();
    expect(captured[0]?.targeting).toBeNull();

    fireEvent.click(screen.getByTestId("notes-targeting-toggle"));
    expect((screen.getByTestId("notes-targeting-toggle") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByTestId("notes-generate-run"));
    await waitFor(() => expect(captured.length).toBe(2));
    expect(captured[1]?.targeting).toEqual({ mode: "weakSpot" });
  });

  // The targeting strip renders on the READING PAGE now (epic-35 T02) —
  // NotePage.test.tsx owns the strip + marker-card body assertions.
});
