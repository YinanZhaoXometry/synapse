/**
 * Epic-3 integration walk (T6), re-seated on the Apollo stub harness at the
 * cutover (epic P2-8): the reader loop the spec's Solution diagrams, walked
 * across the same seams — attach → parse → open → position saved → grounded
 * chat citing the position → reload simulation. Every seam under test is the
 * REAL one: the cutover's two-step upload (attach mutation → presign → a real
 * fetch PUT to storage → the app-wide session-blob registry), the parse seam
 * (parseMaterialBytes — the committed one-page PDF fixture through pdfjs-dist's
 * legacy build — driven exactly as the eager-parse hook drives it, write-back
 * through SetMaterialParseResult), the tracker's positionText shaping, the
 * ReadingProgress / ChatThread persistence mutations, and the simulated
 * Companion (AD-5). Prior art: evidence-loop.integration.test.ts +
 * use-quiz-session.test.tsx.
 *
 * The reload simulation is the honest kind: a reload re-creates the Apollo
 * cache while the SERVER keeps every row — so the walk re-queries through a
 * FRESH stub client over the same captured server state (sections/progress/
 * thread survive), and a fresh session-blob registry starts empty (bytes were
 * memory-only). Re-parse without bytes → null (the re-upload contract, never a
 * fake parse).
 */
import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { mapMaterial } from "@/api/mappers";
import type { MaterialView } from "@/api/views";
import { sessionBlobs, useMaterialUpload } from "@/api";
import { createSessionBlobRegistry } from "@/lib/session-blobs";
import { createHarnessState, createStubClient, makeStubWrapper, type HarnessState, type EchoFixture } from "@/test/apollo-harness";
import {
  AppendChatMessageDocument,
  AttachMaterialDocument,
  ChatThreadDocument,
  CreatePlanDocument,
  CreateMaterialUploadDocument,
  MaterialDocument,
  ReadingProgressDocument,
  SaveReadingProgressDocument,
  SetMaterialParseResultDocument,
} from "@/types/graphql";
import { getCompanionService } from "@/ai/companion-service";
import { useParseMaterialMutation } from "@/features/reader";
import { positionText } from "@/features/reader/position-tracking";
import { parseMaterialBytes } from "@/features/reader/parse-material";
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";

/** The committed one-page fixture, as bytes (copied — pdfjs may detach). */
const fixtureBytes = () =>
  new Uint8Array(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "features/reader/fixtures", "one-page.pdf")),
  );

/**
 * The attach flow's bytes, as a real Blob. jsdom's Blob predates
 * .arrayBuffer(), which the parse seam (and the browser runtime it mirrors)
 * reads bytes through — so the walk hands the flow Node's Blob wearing the
 * File fields the upload reads (name/size): the same interface the browser
 * provides, letting the production path run unmodified.
 */
const fixtureFile = () => {
  // Node's Blob already sizes itself by its bytes; only the File `name` field
  // is missing — defined (read-only `size` cannot be assigned over).
  const file = new NodeBlob([fixtureBytes()]) as unknown as File;
  Object.defineProperty(file, "name", { value: "one-page.pdf" });
  return file;
};

const CREATED = "2026-11-01T00:00:00Z";

describe("the reader loop, end to end (attach → parse → open → position → grounded chat → reload)", () => {
  it("walks FR-8..FR-12 across the seams and lands on the reload contract", async () => {
    // The echo server's captured rows — the reload leg's surviving world.
    const server = {
      materials: [] as EchoFixture[],
      progress: [] as EchoFixture[],
      threads: new Map<string, EchoFixture[]>(),
    };
    const state: HarnessState = createHarnessState();
/** The echo handlers widen the harness's object-only OperationHandler to the
 * wire-record EchoFixture: list roots return ARRAYS and handler inputs are the
 * server's own variable shapes — payloads stay structural, checked on read by
 * the mappers, never by the fixture types. */
type EchoHandler = (variables: EchoFixture, state: HarnessState) => unknown;
    const handlers: Record<string, EchoHandler> = {
      CreatePlan: (variables) => {
        const input = variables.input as EchoFixture;
        const plan = { __typename: "StudyPlan", id: "plan-echo-1", topic: input.topic, goal: input.goal ?? null, createdAt: CREATED, masteryScore: "0" };
        const nodes = (input.nodes as EchoFixture[]).map((n, i) => ({
          __typename: "KnowledgeNode", id: `node-${i + 1}`, planId: plan.id, taskId: null, description: null, optional: false, stage: n.stage ?? null, title: n.title, order: i, masteryScore: "0", state: "uncovered", createdAt: CREATED,
        }));
        return { plan, nodes };
      },
      // the presign: a PUT URL against storage.test — never through the api
      CreateMaterialUpload: () => ({ materialId: "m-echo-1", uploadUrl: "https://storage.test/put", expiresAt: "2026-11-01T01:00:00Z" }),
      AttachMaterial: (variables) => {
        const input = variables.input as EchoFixture;
        const material = {
          __typename: "Material",
          origin: "uploaded",
          generation: null,
          id: "m-echo-1",
          title: input.title,
          kind: input.kind,
          sizeBytes: input.sizeBytes,
          planId: input.planId ?? null,
          taskId: input.taskId ?? null,
          attachmentScope: "plan",
          nodeId: null,
          parseState: input.parseState ?? "pending",
          parseFailureReason: input.parseFailureReason ?? null,
          sections: (input.sections as EchoFixture[]).map((s) => ({ __typename: "MaterialSection", ...s })),
          createdAt: CREATED,
          downloadUrl: null, // presigns are minted per request, never persisted (epic P2-6)
        };
        server.materials.push(material);
        return { material };
      },
      // the parse write-back: pending/parsing are attach-time paints — the wire
      // accepts parsed|failed only, so a parsing write is VALIDATION_FAILED
      SetMaterialParseResult: (variables) => {
        const input = variables.input as EchoFixture;
        const row = server.materials.find((m) => m.id === input.id)!;
        if (input.state === "parsing") throw new Error("VALIDATION_FAILED: parsing is not a wire state");
        row.parseState = input.state;
        row.parseFailureReason = input.reason ?? null;
        row.sections = (input.sections as EchoFixture[]).map((s) => ({ __typename: "MaterialSection", ...s }));
        return { material: row };
      },
      Material: (variables) => server.materials.find((m) => m.id === variables.id) ?? null,
      SaveReadingProgress: (variables) => {
        const input = variables.input as EchoFixture;
        const row = {
          __typename: "ReadingProgress",
          id: `rp-${server.progress.length + 1}`,
          materialId: input.materialId,
          updatedAt: CREATED,
          position: { __typename: "ReadingPosition", text: input.position.text, locator: { __typename: "ReadingLocator", ...input.position.locator } },
        };
        server.progress = server.progress.filter((p) => p.materialId !== input.materialId);
        server.progress.push(row);
        return { readingProgress: row };
      },
      ReadingProgress: (variables) => server.progress.find((p) => p.materialId === variables.materialId) ?? null,
      AppendChatMessage: (variables) => {
        const input = variables.input as EchoFixture;
        const message = {
          __typename: "ChatMessage",
          id: `msg-${(server.threads.get(input.materialId as string) ?? []).length + 1}`,
          role: input.message.role,
          text: input.message.text,
          createdAt: CREATED,
          citations: (input.message.citations as EchoFixture[]).map((c) => ({ __typename: "ReadingLocator", ...c })),
        };
        const thread = server.threads.get(input.materialId as string) ?? [];
        thread.push(message);
        server.threads.set(input.materialId as string, thread);
        return { message };
      },
      ChatThread: (variables) => {
        const messages = server.threads.get(variables.materialId as string) ?? [];
        return { __typename: "ChatThread", id: `thread-${variables.materialId}`, materialId: variables.materialId, planId: null, updatedAt: CREATED, messages };
      },
    };
    const client = createStubClient(handlers, state);

    // 1. attach (FR-29 relaxed + AD-7): plan, material attached parse-pending
    //    through the REAL upload flow — attach mutation, presign, a real fetch
    //    PUT to storage (stubbed to answer ok and captured), bytes parked in
    //    the app-wide session registry — exactly what PlanHome's attach does.
    const putCalls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: RequestInfo | URL, init: RequestInit = {}) => {
      putCalls.push({ url: String(url), init });
      return { ok: true };
    });
    await client.mutate({ mutation: CreatePlanDocument, variables: { input: { clientUuid: crypto.randomUUID(), topic: "COMP5241 软件工程", goal: "exam prep", nodes: [{ title: "阅读材料", stage: "需求" }] } } });
    const { result } = renderHook(() => useMaterialUpload(), { wrapper: makeStubWrapper(client) });
    let attached: MaterialView | undefined;
    await act(async () => {
      attached = await result.current.attach({ file: fixtureFile(), title: "one-page.pdf", kind: "pdf", planId: "plan-echo-1", taskId: null });
    });
    expect(attached?.parseState).toBe("pending"); // AD-7: attach lands parse-pending
    expect(putCalls).toHaveLength(1); // the bytes went straight to storage
    expect(putCalls[0].url).toBe("https://storage.test/put");
    expect(putCalls[0].init.method).toBe("PUT");
    expect(sessionBlobs.has("m-echo-1")).toBe(true);
    const pendingRow = await client.query({ query: MaterialDocument, variables: { id: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(pendingRow.data.material.parseState).toBe("pending");

    // 2. parse: the eager-parse hook's public path, run exactly as the task
    //    creation flow runs it — the row binds AFTER the attach (TaskCreatePage's
    //    setAttached), bytes resolve from the session registry, the REAL
    //    parse(file) runs (pdfjs), and the outcome writes back through
    //    SetMaterialParseResult (the parsing paint is rejected on the wire).
    //    (.ts file — the provider stack is built with createElement, no JSX)
    const providerWrapper = ({ children }: { children: ReactNode }) =>
      createElement(LanguageProvider, null, makeStubWrapper(client)({ children }));
    const parse = renderHook(() => useParseMaterialMutation(attached), { wrapper: providerWrapper });
    parse.result.current.mutate("m-echo-1");
    // The write-back rides the attach → presign → parse → mutation chain —
    // give the conditional wait room for a loaded CI runner (default 1s
    // expired there while every local run was instant).
    await waitFor(() => expect(server.materials[0].parseState).toBe("parsed"), { timeout: 10_000 });

    // 3. parsed with sections — the extracted text now survives server-side
    const parsedRaw = await client.query({ query: MaterialDocument, variables: { id: "m-echo-1" }, fetchPolicy: "network-only" });
    const parsed = mapMaterial(parsedRaw.data.material);
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
    await client.mutate({ mutation: SaveReadingProgressDocument, variables: { input: { materialId: "m-echo-1", position: { locator: position.locator, text: position.text } } } });
    const progress = await client.query({ query: ReadingProgressDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(progress.data.readingProgress.position.locator).toEqual({ __typename: "ReadingLocator", kind: "pdf", page: 1 });

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
    await client.mutate({ mutation: AppendChatMessageDocument, variables: { input: { materialId: "m-echo-1", message: { role: "user", text: "What does this fixture page say?", citations: [] } } } });
    await client.mutate({
      mutation: AppendChatMessageDocument,
      variables: {
        input: {
          materialId: "m-echo-1",
          message: { role: "companion", text: reply.text, citations: reply.citations.map((citation) => citation.locator) },
        },
      },
    });
    const thread = await client.query({ query: ChatThreadDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(thread.data.chatThread.messages).toHaveLength(2);
    expect(thread.data.chatThread.messages[1].citations).toEqual([{ __typename: "ReadingLocator", kind: "pdf", page: 1 }]);

    // 7. reload simulation: same server state, fresh Apollo cache. A reload
    //    re-creates the client, so the walk re-queries through a FRESH stub
    //    client — sections + ReadingProgress + ChatThread survive (AD-4
    //    relaxed contract, server-side now), the session-blob registry
    //    re-creates empty (bytes were memory-only).
    const reloaded = createStubClient(handlers, state);
    const reloadedRaw = await reloaded.query({ query: MaterialDocument, variables: { id: "m-echo-1" }, fetchPolicy: "network-only" });
    const reloadedMaterial = mapMaterial(reloadedRaw.data.material);
    expect(reloadedMaterial.parseState).toBe("parsed");
    expect(reloadedMaterial.sections).toEqual(parsed.sections);
    const reloadedProgress = await reloaded.query({ query: ReadingProgressDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(reloadedProgress.data.readingProgress.position.text).toBe(position.text);
    const reloadedThread = await reloaded.query({ query: ChatThreadDocument, variables: { materialId: "m-echo-1" }, fetchPolicy: "network-only" });
    expect(reloadedThread.data.chatThread.messages).toHaveLength(2);

    // the bytes are gone — and re-parse is impossible without them: the pure
    // seam returns null (the re-upload contract), never a fake parse
    const freshRegistryBytes = createSessionBlobRegistry().get("m-echo-1");
    expect(freshRegistryBytes).toBeUndefined();
    expect(await parseMaterialBytes(reloadedMaterial, freshRegistryBytes)).toBeNull();
  });
});
