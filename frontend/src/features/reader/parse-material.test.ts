import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import type { MaterialView } from "@/api/views";
import { parseMaterialBytes } from "./parse-material";

/**
 * The eager-parse bridge (AD-7): a material's bytes → the reader's parse → the
 * honest outcome, as a pure async function. The pending|failed → parsing →
 * parsed|failed state machine and the outcome write-back live in the
 * use-parse-material hook seam (Apollo mutation); this suite pins the outcome
 * mapping and the no-bytes honesty rule. Prior art: parse.test.ts (the
 * pipeline itself) / entry-decision.test.ts (state transitions).
 *
 * The tests use Node's Blob because jsdom 20's lacks arrayBuffer(); a real
 * browser Blob (what the attach flow stores) has it, and the production code
 * reads bytes through that standard API only. The cast bridges the type realms
 * (node:buffer Blob vs lib.dom Blob) — the runtime shape is what matters here.
 */
const blob = (content: string): Blob => new NodeBlob([content]) as unknown as Blob;

const material = (overrides: Partial<MaterialView> = {}): MaterialView => ({
  id: "m-1",
  title: "notes.md",
  kind: "markdown",
  sizeBytes: 100,
  planId: "p-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "pending",
  parseFailureReason: undefined,
  sections: [],
  createdAt: "2026-11-04T00:00:00Z",
  downloadUrl: null,
  ...overrides,
});

describe("parseMaterialBytes — attach-flow parse outcome", () => {
  it("markdown bytes → parsed outcome with slugged sections", async () => {
    const md = ["# 第一章: 引言", "内容一。", "# 第一章: 引言", "内容二。"].join("\n");
    const outcome = await parseMaterialBytes(material(), blob(md));
    expect(outcome?.state).toBe("parsed");
    expect(outcome?.reason).toBeUndefined();
    expect(outcome?.sections.map((s) => s.id)).toEqual(["第一章-引言", "第一章-引言-1"]);
    expect(outcome?.sections.map((s) => s.title)).toEqual(["第一章: 引言", "第一章: 引言"]);
    expect(outcome?.sections[0]?.text).toContain("内容一。");
    expect(outcome?.sections[1]?.text).toContain("内容二。");
  });

  it("garbage pdf bytes → failed outcome with the corrupt reason", async () => {
    const outcome = await parseMaterialBytes(
      material({ kind: "pdf", title: "broken.pdf" }),
      blob("garbage, not a pdf"),
    );
    expect(outcome?.state).toBe("failed");
    expect(outcome?.reason).toBe("corrupt");
    expect(outcome?.sections).toEqual([]);
  });

  it("whitespace-only markdown → failed with the empty reason (a retry starts here)", async () => {
    const outcome = await parseMaterialBytes(material(), blob("   \n  "));
    expect(outcome?.state).toBe("failed");
    expect(outcome?.reason).toBe("empty");
  });

  it("no bytes (reload simulation) → null — the re-upload contract, never a fake parse", async () => {
    const outcome = await parseMaterialBytes(material({ parseState: "failed" }), undefined);
    expect(outcome).toBeNull();
  });
});
