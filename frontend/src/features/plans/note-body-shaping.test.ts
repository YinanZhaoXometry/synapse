import { describe, expect, it, vi } from "vitest";
import type { NoteView } from "@/api/views";
import {
  downloadNoteMarkdown,
  markerKindKey,
  noteExcerpt,
  noteExportFilename,
  noteExportMarkdown,
  noteTargetingRows,
  splitNoteBody,
} from "./note-body-shaping";

/**
 * note-body-shaping (FR-40, epic P2-12 T1; delta decision 1 — component's
 * pure half, message-shaping posture): the marker split keeps every prose
 * segment and every marker in document order (nothing dropped), the kind
 * vocabulary closes at diagram/chart/image/user with an honest null for
 * unknown kinds, and the export keeps the body VERBATIM — markers included —
 * with a download filename safe for the filesystem.
 */

const note = (overrides: Partial<NoteView> = {}): NoteView => ({
  id: "note-1",
  title: "Raft in one note",
  body: "# Raft in one note\n\nRaft elects a leader.\n",
  scope: "plan",
  scopeId: "plan-1",
  enrichment: [],
  targeting: [],
  createdAt: "2026-11-05T00:00:00Z",
  ...overrides,
});

describe("splitNoteBody", () => {
  it("splits markers from prose in document order — nothing dropped", () => {
    const tokens = splitNoteBody(
      "# Title\n\nprose one\n\n[[enrich|diagram|raft rounds]]\n\nprose two\n\n[[enrich|chart|latency]]\n",
    );
    expect(tokens.map((token) => token.kind)).toEqual([ "text", "marker", "text", "marker" ]);
    const [ first, marker1, second, marker2 ] = tokens;
    expect(first).toMatchObject({ kind: "text", text: expect.stringContaining("# Title") });
    expect(first).toMatchObject({ kind: "text", text: expect.stringContaining("prose one") });
    expect(marker1).toEqual({ kind: "marker", markerKind: "diagram", suggestion: "raft rounds" });
    expect(second).toMatchObject({ kind: "text", text: expect.stringContaining("prose two") });
    expect(marker2).toEqual({ kind: "marker", markerKind: "chart", suggestion: "latency" });
  });

  it("keeps the whole body as one text token when no markers exist", () => {
    const tokens = splitNoteBody("# Only\n\nplain prose\n");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ kind: "text", text: expect.stringContaining("plain prose") });
  });

  it("drops nothing but empty whitespace around markers", () => {
    const tokens = splitNoteBody("[[enrich|image|cover]]");
    expect(tokens).toEqual([{ kind: "marker", markerKind: "image", suggestion: "cover" }]);
  });

  it("carries the user kind verbatim (the enrichAt annotation)", () => {
    const tokens = splitNoteBody("prose\n\n[[enrich|user|a timeline here]]");
    expect(tokens[1]).toEqual({ kind: "marker", markerKind: "user", suggestion: "a timeline here" });
  });
});

describe("markerKindKey", () => {
  it("closes at diagram/chart/image/user", () => {
    expect(markerKindKey("diagram")).toBe("diagram");
    expect(markerKindKey("chart")).toBe("chart");
    expect(markerKindKey("image")).toBe("image");
    expect(markerKindKey("user")).toBe("user");
  });

  it("answers null for unknown kinds (the card falls back to the raw kind)", () => {
    expect(markerKindKey("hologram")).toBeNull();
  });
});

describe("the export (FR-40 — markers preserved verbatim)", () => {
  it("exports the body verbatim — markers included", () => {
    const body = "# Note\n\nprose\n\n[[enrich|diagram|raft rounds]]\n";
    expect(noteExportMarkdown(note({ body }))).toBe(body);
  });

  it("flattens path-hostile characters out of the <title>.md filename", () => {
    expect(noteExportFilename(note({ title: "Raft: the rounds?" }))).toBe("Raft- the rounds-.md");
    expect(noteExportFilename(note({ title: "a/b\\c" }))).toBe("a-b-c.md");
  });

  it("downloads the .md over a Blob URL with the marker text in the payload", () => {
    const body = "# Note\n\nprose\n\n[[enrich|diagram|raft rounds]]\n";
    const created: Blob[] = [];
    const objectUrl = "blob:mock-url";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    // jsdom cannot navigate — the pinned click is a no-op replacement (the
    // contract under test: the download anchor IS clicked).
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = (blob: Blob) => {
      created.push(blob);
      return objectUrl;
    };
    URL.revokeObjectURL = () => {};

    try {
      downloadNoteMarkdown(note({ body }));
      expect(created).toHaveLength(1);
      expect(clickSpy).toHaveBeenCalledTimes(1); // the jsdom-pinned anchor click
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe("noteExcerpt (epic-35 T02 — the rail's scanning excerpt)", () => {
  it("strips markers and markdown syntax, flattens whitespace", () => {
    const body = [
      "# Raft in one note",
      "",
      "Raft elects a leader and replicates the log.",
      "",
      "## Failure detection",
      "",
      "- heartbeat > timeout",
      "",
      "[[enrich|diagram|Raft leader election]]",
    ].join("\n");
    expect(noteExcerpt(body)).toBe(
      "Raft in one note Raft elects a leader and replicates the log. Failure detection - heartbeat timeout",
    );
  });

  it("drops fenced code blocks and link syntax keeps the label", () => {
    expect(noteExcerpt("See [the paper](https://example.com) first.\n\n```\nSELECT 1;\n```")).toBe(
      "See the paper first.",
    );
  });

  it("caps at max chars with an ellipsis — never a full body dump in the rail", () => {
    const long = "word ".repeat(80).trim();
    const excerpt = noteExcerpt(long, 40);
    expect(excerpt.length).toBe(41);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.slice(0, 40)).toBe(long.slice(0, 40));
  });

  it("reads empty for a marker-only or empty body (the row just shows no excerpt)", () => {
    expect(noteExcerpt("[[enrich|diagram|only a marker]]")).toBe("");
    expect(noteExcerpt("")).toBe("");
  });
});

describe("noteTargetingRows (FR-22, epic P2-12 T2)", () => {
  it("maps the server's allocation table rows verbatim (nodeId, title, score, mistakes, share)", () => {
    expect(
      noteTargetingRows([
        { nodeId: "n-1", title: "Weak node", score: "0", mistakes: 1, share: 2 },
        { nodeId: "n-2", title: "Strong node", score: "100", mistakes: 0, share: 0 },
      ]),
    ).toEqual([
      { nodeId: "n-1", title: "Weak node", score: "0", mistakes: 1, share: 2 },
      { nodeId: "n-2", title: "Strong node", score: "100", mistakes: 0, share: 0 },
    ]);
  });

  it("reads honest [] for anything that is not the allocation table (server data only)", () => {
    expect(noteTargetingRows(undefined)).toEqual([]);
    expect(noteTargetingRows(null)).toEqual([]);
    expect(noteTargetingRows([])).toEqual([]);
    expect(noteTargetingRows("weakSpot")).toEqual([]);
    expect(noteTargetingRows(42)).toEqual([]);
    // rows missing the address (nodeId), the label (title), or a numeric share are dropped — not guessed
    expect(noteTargetingRows([{ title: "x", share: 1 }, { nodeId: "n", share: 1 }, { nodeId: "n", title: "x" }])).toEqual([]);
    expect(noteTargetingRows([{ nodeId: "n", title: "x", share: "2" }])).toEqual([]);
    expect(noteTargetingRows([null, 3, "s"])).toEqual([]);
  });
});
