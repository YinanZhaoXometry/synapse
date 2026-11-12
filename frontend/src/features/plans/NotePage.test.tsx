import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { PlanDocument, PlanNotesDocument } from "@/types/graphql";
import type { NoteView } from "@/api/views";
import NotePage from "./NotePage";
import { splitNoteBody } from "./note-body-shaping";

/**
 * NotePage (epic-35 T02 — the standalone reading page at
 * /plan/:id/notes/:noteId): long notes leave the plan-home rail and read in
 * a full-page 70ch column over the SAME NoteBodyView — the targeting
 * provenance strip renders from the server's targeting rows only (untargeted
 * notes stay stripless), marker cards render per kind, the scope's resolved
 * target title comes from the Plan detail read (never a raw uuid), an
 * unknown id is an honest not-found, and export downloads the body verbatim
 * (stubbed Blob; the anchor click jsdom-pinned). Fixture shapes ride the
 * NotesSection/node-row test posture (wire fixtures for Apollo
 * normalization).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

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

/** Wire-shaped fixture rows: the cache write needs __typename (Apollo normalization). */
const wire = (n: NoteView) => ({
  ...n,
  enrichment: n.enrichment.map((marker) => ({ ...marker, __typename: "NoteMarker" })),
  __typename: "Note",
});

const notesMock = (notes: NoteView[]): MockedResponse => ({
  request: { query: PlanNotesDocument, variables: { planId: "plan-1" } },
  result: { data: { notes: notes.map(wire) } },
});

/** The Plan detail read — scopeTarget resolves node/material titles from it. */
const planMock: MockedResponse = {
  request: { query: PlanDocument, variables: { id: "plan-1" } },
  result: {
    data: {
      __typename: "Query",
      plan: {
        __typename: "StudyPlan",
        id: "plan-1",
        topic: "Distributed systems",
        goal: null,
        createdAt: "2026-11-05T00:00:00Z",
        masteryScore: "0",
        visibility: "private",
        forkedFromTopic: null,
        edges: [],
        nodes: [
          { __typename: "KnowledgeNode", id: "n-1", planId: "plan-1", taskId: null, stage: null, title: "Consensus", description: null, optional: false, studyMark: null, order: 0, masteryScore: "0", state: "uncovered", createdAt: "2026-11-05T00:00:00Z" },
          { __typename: "KnowledgeNode", id: "n-2", planId: "plan-1", taskId: null, stage: null, title: "Replication", description: null, optional: false, studyMark: null, order: 1, masteryScore: "40", state: "partial", createdAt: "2026-11-05T00:00:00Z" },
        ],
        materials: [
          { __typename: "Material", id: "m-1", title: "Distributed systems notes", kind: "markdown", sizeBytes: 1, planId: "plan-1", taskId: null, attachmentScope: "plan", nodeId: null, parseState: "parsed", parseFailureReason: null, createdAt: "2026-11-05T00:00:00Z", downloadUrl: null, origin: "uploaded" },
        ],
      },
    },
  },
};

function mountNotePage(noteId: string, mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/plan/plan-1/notes/${noteId}`]}>
          <Routes>
            <Route path="/plan/:id/notes/:noteId" element={<NotePage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </MockedProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotePage (epic-35 T02 — the reading page over the shared NoteBodyView)", () => {
  it("renders the full body — title, scope chip, markdown, marker cards per kind, targeting strip", async () => {
    const targeted = note({
      id: "note-1",
      targeting: [
        { nodeId: "n-1", title: "Consensus", score: "0", mistakes: 1, share: 2 },
        { nodeId: "n-2", title: "Replication", score: "40", mistakes: 0, share: 1 },
      ],
    });
    mountNotePage("note-1", [ notesMock([targeted]), planMock ]);

    expect(await screen.findByTestId("note-page-title")).toHaveTextContent("Raft in one note");
    expect(screen.getByText(zh("notes.chipPlan"))).toBeTruthy();
    // the markdown body + marker cards ride the lazy renderer — async resolves
    expect(await screen.findByText("Raft elects a leader and replicates the log.")).toBeTruthy();

    const strip = screen.getByTestId("note-targeting-strip");
    expect(strip.textContent).toContain(zh("notes.targetingLabel"));
    const chips = strip.querySelectorAll("[data-testid='note-targeting-chip']");
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute("title")).toBe(zh("notes.targetingShare").replace("{share}", "2"));

    const cards = await screen.findAllByTestId("note-marker-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute("data-marker-kind")).toBe("diagram");
    expect(cards[1].getAttribute("data-marker-kind")).toBe("chart");
    expect(cards[2].getAttribute("data-marker-kind")).toBe("user");
    expect(cards[2].textContent).toContain(zh("notes.kind.user"));
    expect(cards[2].textContent).toContain("a timeline of the consensus rounds");
  });

  it("keeps untargeted notes stripless — targeting [] never renders a strip", async () => {
    mountNotePage("note-1", [ notesMock([note({ id: "note-1" })]), planMock ]);

    await waitFor(() => expect(screen.getByTestId("note-body")).toBeTruthy());
    expect(screen.queryByTestId("note-targeting-strip")).toBeNull();
  });

  it("resolves a node-scoped note's target title from the Plan read — never a raw uuid", async () => {
    mountNotePage("note-2", [ notesMock([note({ id: "note-2", scope: "node", scopeId: "n-1" })]), planMock ]);

    await waitFor(() => expect(screen.getByTestId("note-page-title")).toBeTruthy());
    expect(screen.getByText("Consensus")).toBeTruthy();
  });

  it("backs to the plan home", async () => {
    mountNotePage("note-1", [ notesMock([note({ id: "note-1" })]), planMock ]);

    const back = await screen.findByTestId("note-back");
    expect(back.getAttribute("href")).toBeNull(); // a button, not a link — navigation via router
    expect(back.textContent).toContain(zh("reader.backToPlan"));
  });

  it("is honest about an unknown id — not-found, never a fake body", async () => {
    mountNotePage("missing", [ notesMock([note({ id: "note-1" })]), planMock ]);

    expect(await screen.findByTestId("note-not-found")).toBeTruthy();
    expect(screen.getByText(zh("notes.notFound"))).toBeTruthy();
    expect(screen.queryByTestId("note-body")).toBeNull();
  });

  it("exports the body verbatim with the markers (stubbed Blob, jsdom-pinned anchor click)", async () => {
    const payloads: string[] = [];
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
      mountNotePage("note-1", [ notesMock([note({ id: "note-1" })]), planMock ]);
      const user = userEvent.setup();
      await user.click(await screen.findByTestId("note-export"));

      await waitFor(() => expect(payloads).toHaveLength(1));
      const text = payloads[0];
      expect(text).toContain("# Raft in one note");
      for (const token of splitNoteBody(NOTE_BODY)) {
        if (token.kind === "marker") expect(text).toContain(`[[enrich|${token.markerKind}|${token.suggestion}]]`);
      }
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
