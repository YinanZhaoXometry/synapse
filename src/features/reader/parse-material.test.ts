import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it } from "vitest";
import { getMaterial, registerMaterial } from "@/data";
import { sessionBlobs } from "@/data/session-blobs";
import { parseFromSessionBlob } from "./parse-material";

/**
 * The eager-parse bridge (AD-7): a registered material's session-only bytes →
 * the reader's parse → repository write-back. Runs against real localStorage
 * and the real app-wide blob registry. Prior art: material-repository.test.ts
 * (reload simulation) / entry-decision.test.ts (state transitions).
 *
 * The tests use Node's Blob because jsdom 20's lacks arrayBuffer(); a real
 * browser Blob (what the attach flow stores) has it, and the production code
 * reads bytes through that standard API only. The cast bridges the type realms
 * (node:buffer Blob vs lib.dom Blob) — the runtime shape is what matters here.
 */
const blob = (content: string): Blob => new NodeBlob([content]) as unknown as Blob;

beforeEach(() => {
  localStorage.clear();
});

describe("parseFromSessionBlob — attach-flow parse outcome write-back", () => {
  it("pending material + bytes → parsed outcome persisted (sections replace the pending state)", async () => {
    const md = ["# 第一章: 引言", "内容一。", "# 第一章: 引言", "内容二。"].join("\n");
    const { material } = registerMaterial({
      title: "notes.md",
      kind: "markdown",
      sizeBytes: 100,
      planId: "p-1",
      taskId: null,
      blob: blob(md),
      sections: [],
      parseState: "pending",
    });

    const outcome = await parseFromSessionBlob(material.id);
    expect(outcome?.state).toBe("parsed");
    const stored = getMaterial(material.id);
    expect(stored?.parseState).toBe("parsed");
    expect(stored?.parseFailureReason).toBeUndefined();
    expect(stored?.sections.map((s) => s.id)).toEqual(["第一章-引言", "第一章-引言-1"]);
    expect(stored?.title).toBe("notes.md"); // metadata untouched
  });

  it("garbage bytes → failed outcome persisted with the corrupt reason; metadata kept", async () => {
    const { material } = registerMaterial({
      title: "broken.pdf",
      kind: "pdf",
      sizeBytes: 50,
      planId: null,
      taskId: null,
      blob: blob("garbage, not a pdf"),
      sections: [],
      parseState: "pending",
    });

    const outcome = await parseFromSessionBlob(material.id);
    expect(outcome?.state).toBe("failed");
    expect(outcome?.reason).toBe("corrupt");
    const stored = getMaterial(material.id);
    expect(stored?.parseState).toBe("failed");
    expect(stored?.parseFailureReason).toBe("corrupt");
    expect(stored?.sections).toEqual([]);
    expect(stored?.title).toBe("broken.pdf"); // a failed parse never reads as lost data
  });

  it("retry: fresh bytes in the session registry re-run the parse from failed to parsed", async () => {
    const md = "# Fixed\nnow it parses";
    const { material } = registerMaterial({
      title: "retry.md",
      kind: "markdown",
      sizeBytes: 10,
      planId: null,
      taskId: null,
      blob: blob("   \n  "), // whitespace-only — nothing to extract
      sections: [],
      parseState: "pending",
    });
    // first attempt fails with the empty reason
    const failed = await parseFromSessionBlob(material.id);
    expect(failed?.state).toBe("failed");

    // the retry path: new bytes land in the registry, the parse re-runs
    sessionBlobs.put(material.id, blob(md));
    const retried = await parseFromSessionBlob(material.id);
    expect(retried?.state).toBe("parsed");
    const stored = getMaterial(material.id);
    expect(stored?.parseState).toBe("parsed");
    expect(stored?.parseFailureReason).toBeUndefined();
    expect(stored?.sections[0].id).toBe("fixed");
  });

  it("bytes gone (reload simulation): no parse, state untouched — the re-upload contract", async () => {
    // no blob in the registry — exactly like after a reload (sessionBlobs is
    // fresh memory each page load; metadata + state persist, bytes do not)
    const { material } = registerMaterial({
      title: "gone.pdf",
      kind: "pdf",
      sizeBytes: 10,
      planId: null,
      taskId: null,
      sections: [],
      parseState: "failed",
    });

    const outcome = await parseFromSessionBlob(material.id);
    expect(outcome).toBeNull();
    const stored = getMaterial(material.id);
    expect(stored?.parseState).toBe("failed"); // unchanged — never faked into parsing/parsed
    expect(sessionBlobs.has(material.id)).toBe(false);
  });
});
