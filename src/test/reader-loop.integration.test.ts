/**
 * Epic-3 integration walk (T6): the reader loop the spec's Solution diagrams,
 * walked across the same seams as the evidence loop — attach → parse → open →
 * position saved → grounded chat citing the position → reload simulation.
 * Every seam under test is the REAL one: the attach flow's registry choice
 * (app-wide sessionBlobs), the parse(file) path (the committed one-page PDF
 * fixture through pdfjs-dist's legacy build, write-back through the material
 * repository), the tracker's positionText shaping, the ReadingProgress /
 * ChatThread repositories, and the simulated Companion (AD-5). Prior art:
 * evidence-loop.integration.test.ts.
 *
 * The reload simulation is the honest kind: a reload keeps localStorage and
 * re-creates every in-memory module — so the walk resets the module registry
 * (vi.resetModules) and imports fresh data/reader modules against the SAME
 * localStorage key. Fresh blob registry → bytes gone; fresh repositories →
 * sections/progress/thread survive; re-parse without bytes → null (the
 * re-upload contract, never a fake parse).
 */
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  appendChatMessage,
  createPlan,
  getChatThread,
  getMaterial,
  getReadingProgress,
  registerMaterial,
  saveReadingProgress,
  sessionBlobs,
} from "@/data";
import { getCompanionService } from "@/ai/companion-service";
import { positionText } from "@/features/reader/position-tracking";
import { parseFromSessionBlob } from "@/features/reader/parse-material";
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";

/** The committed one-page fixture, as bytes (copied — pdfjs may detach). */
const fixtureBytes = () =>
  new Uint8Array(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "features/reader/fixtures", "one-page.pdf")),
  );

/**
 * The attach flow's bytes, as a real Blob. jsdom's Blob predates
 * .arrayBuffer(), which the parse seam (and the browser runtime it mirrors)
 * reads bytes through — so the walk hands the registry Node's Blob: the same
 * interface the browser provides, letting the production path run unmodified.
 */
const fixtureBlob = () => new NodeBlob([fixtureBytes()]) as unknown as Blob;

beforeEach(() => {
  localStorage.clear();
});

describe("the reader loop, end to end (attach → parse → open → position → grounded chat → reload)", () => {
  it("walks FR-8..FR-12 across the seams and lands on the reload contract", async () => {
    // 1. attach (FR-29 relaxed + AD-7): plan, material registered pending-parse,
    //    bytes into the app-wide session registry — exactly what PlanHome's
    //    attach flow does (registerMaterial with a blob and no registry arg).
    const { plan } = createPlan({
      topic: "COMP5241 软件工程",
      goal: "exam prep",
      nodes: [{ title: "阅读材料", stage: "需求" }],
    });
    const bytes = fixtureBytes();
    const { material } = registerMaterial({
      title: "one-page.pdf",
      kind: "pdf",
      sizeBytes: bytes.byteLength,
      planId: plan.id,
      taskId: null,
      blob: fixtureBlob(),
      sections: [],
      parseState: "pending",
    });
    expect(sessionBlobs.has(material.id)).toBe(true);

    // 2. parse: the reader's public path, run exactly as eager-parse-at-attach
    //    runs it — parseFromSessionBlob reads the session bytes, calls the real
    //    parseFile (pdfjs), and writes the outcome back through the repository.
    const outcome = await parseFromSessionBlob(material.id);
    expect(outcome).not.toBeNull();
    expect(outcome.state).toBe("parsed");

    // 3. parsed with sections — the extracted text now survives in synapse-db
    const parsed = getMaterial(material.id);
    expect(parsed.parseState).toBe("parsed");
    expect(parsed.sections.map((s) => s.id)).toEqual(["page-1"]);
    expect(parsed.sections[0].title).toBe("Introduction");
    expect(parsed.sections[0].text).toContain("Synapse reader fixture page one.");

    // 4. open + read (FR-10): the position tracker persists what is visible.
    //    ReadingPosition.text is the BOUNDED EXTRACTED section text — the
    //    grounding input — never raw file bytes (AD-4).
    const locator: ReadingLocator = { kind: "pdf", page: 1 };
    const position: ReadingPosition = { locator, text: positionText(parsed, locator) };
    expect(position.text).toBe(parsed.sections[0].text);
    saveReadingProgress(material.id, position);
    expect(getReadingProgress(material.id)?.position).toEqual(position);

    // 5. grounded chat (FR-11): the Companion answers FROM that position and
    //    cites it (NFR-1) — streamed, guardrail rung rendered from the contract.
    const chunks: string[] = [];
    const reply = await getCompanionService().chat(
      { question: "What does this fixture page say?", position, language: "zh" },
      (chunk) => chunks.push(chunk),
    );
    expect(chunks.length).toBeGreaterThan(0); // streamed, not returned whole
    expect(reply.rung).toBe("answer");
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations[0].locator).toEqual(locator);
    expect(reply.citations[0].quote).toContain("Synapse reader fixture page one");

    // 6. the thread persists BOTH rows (use-companion-chat's honesty rule: a
    //    turn is written only once its request completes — user first, then the
    //    companion reply carrying the citation locators, AD-3/4).
    appendChatMessage(material.id, { role: "user", text: "What does this fixture page say?", citations: [] });
    appendChatMessage(material.id, {
      role: "companion",
      text: reply.text,
      citations: reply.citations.map((citation) => citation.locator),
    });
    const thread = getChatThread(material.id);
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[1].citations).toEqual([locator]);

    // 7. reload simulation: same localStorage, fresh in-memory world. A reload
    //    re-creates every module, so reset the registry and import fresh ones —
    //    the fresh session-blob registry starts empty (bytes were memory-only).
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull(); // the document persisted
    vi.resetModules();
    const fresh = await import("@/data");
    const freshReader = await import("@/features/reader/parse-material");

    // sections + ReadingProgress + ChatThread survive (AD-4 relaxed contract)
    const reloaded = fresh.getMaterial(material.id);
    expect(reloaded.parseState).toBe("parsed");
    expect(reloaded.sections).toEqual(parsed.sections);
    expect(fresh.getReadingProgress(material.id)?.position).toEqual(position);
    expect(fresh.getChatThread(material.id)?.messages).toHaveLength(2);

    // the bytes are gone — and re-parse is impossible without them: the seam
    // returns null (the re-upload contract), never a fake parse
    expect(fresh.sessionBlobs.has(material.id)).toBe(false);
    expect(await freshReader.parseFromSessionBlob(material.id)).toBeNull();
  });
});
