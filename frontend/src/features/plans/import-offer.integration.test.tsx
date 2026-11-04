import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { sessionBlobs } from "@/lib/session-blobs";
import { LOCAL_DOC_KEY } from "@/lib/local-document";
import { shouldOfferImport } from "@/lib/import-offer";
import { createStubClient, makeStubWrapper, type EchoFixture, type HarnessState } from "@/test/apollo-harness";
import ImportOfferDialog from "./ImportOfferDialog";

/**
 * The first-login import flow through the stub harness (epic P2-8 T3; AD-15
 * / AD-20; ticket ACs): a populated Phase-1 document imports as ONE
 * ImportDocument mutation with the doc's own uuids, the done marker lands,
 * the legacy document stays byte-identical on disk (the rollback substrate —
 * never deleted client-side), the offer never re-shows, a failure is honest
 * (offer stays, retry safe, the server's idempotency makes retries safe),
 * and the re-attach invite offers the byteless materials back through
 * refreshBytes (matched by id; skipped rows stay honest — text-only).
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const NODE_ID = "22222222-2222-4222-8222-222222222222";
const PDF_ID = "33333333-3333-4333-8333-333333333333";
const MD_ID = "66666666-6666-4666-8666-666666666666";

const legacyDoc = {
  version: 1,
  onboardingComplete: true,
  plans: [
    { id: PLAN_ID, topic: "软工备考", goal: "考试就绪", nodeIds: [NODE_ID], materialIds: [PDF_ID], createdAt: "2026-10-01T00:00:00.000Z" },
  ],
  nodes: [{ id: NODE_ID, planId: PLAN_ID, taskId: null, stage: "基础", title: "绪论", order: 0 }],
  materials: [
    {
      id: PDF_ID, title: "讲义.pdf", kind: "pdf", sizeBytes: 2048, planId: PLAN_ID, taskId: null,
      parseState: "parsed", sections: [{ id: "page-1", title: "第 1 页", text: "提取的文本。" }],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: MD_ID, title: "笔记.md", kind: "markdown", sizeBytes: 512, planId: null, taskId: null,
      parseState: "parsed", sections: [{ id: "sec-1", title: "笔记", text: "笔记文本。" }],
      createdAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  tasks: [], sessions: [], questions: [], evidence: [], flashcards: [], mistakes: [],
  readingProgress: [
    { materialId: PDF_ID, position: { locator: { kind: "pdf", page: 2 }, text: "第 2 页文本" }, updatedAt: "2026-10-02T00:00:00.000Z" },
  ],
  chatThreads: [], sectionMarkings: [],
};

/** The harness handlers + the mutation capture the tests assert on. */
function importHarness(mode: "success" | "network-failure" | "validation-failure") {
  const state: HarnessState = { sessions: [], evidence: [], mistakes: [], plans: [] };
  const importCalls: Array<Record<string, unknown>> = [];
  const uploadCalls: Array<Record<string, unknown>> = [];
  let importMode = mode;
  const handlers: Record<string, (variables: EchoFixture, state: HarnessState) => unknown> = {
    ImportDocument: (variables) => {
      importCalls.push(variables);
      if (importMode === "network-failure") throw new Error("simulated network failure");
      if (importMode === "validation-failure") {
        // the Apollo 4 error model's wire shape: a result object carrying the
        // formatted GraphQL errors (extensions.code = the closed enum)
        throw new CombinedGraphQLErrors({
          errors: [
            { message: "client uuid already belongs to another user", extensions: { code: "VALIDATION_FAILED" } },
          ],
        });
      }
      return { imported: legacyDoc.plans.length + legacyDoc.nodes.length + legacyDoc.materials.length + legacyDoc.readingProgress.length, skipped: 0 };
    },
    CreateMaterialUpload: (variables) => {
      uploadCalls.push(variables);
      return { materialId: (variables as { input?: { materialId?: string } }).input?.materialId, uploadUrl: "https://storage.example/put", expiresAt: "2026-11-04T12:00:00.000Z" };
    },
    // the mutation's refetch sweep — empty lists, nothing cached yet
    Plans: () => [],
    Tasks: () => [],
    Materials: () => [],
    ReadingProgressList: () => [],
  };
  const client = createStubClient(handlers, state);
  const setImportMode = (next: typeof mode) => {
    importMode = next;
  };
  return { client, importCalls, uploadCalls, setImportMode };
}

function mountImportOffer(world: ReturnType<typeof importHarness>) {
  return render(
    <LanguageProvider>
      <Toaster />
      {makeStubWrapper(world.client)({ children: <ImportOfferDialog /> })}
    </LanguageProvider>,
  );
}

const importButton = () => screen.getByRole("button", { name: zh("import.importAction") });

beforeEach(() => {
  localStorage.clear();
});

describe("ImportOfferDialog — the one-time offer", () => {
  it("offers when the legacy document holds data (bilingual copy, zh default)", () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const world = importHarness("success");

    mountImportOffer(world);

    expect(screen.getByText(zh("import.offerTitle"))).toBeInTheDocument();
    expect(screen.getByText(zh("import.offerBody"))).toBeInTheDocument();
    expect(importButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("import.notNow") })).toBeInTheDocument();
  });

  it("runs the whole document as ONE mutation, marks done, leaves the local doc byte-identical, and never re-offers", async () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const rawBefore = localStorage.getItem(LOCAL_DOC_KEY);
    const world = importHarness("success");

    mountImportOffer(world);
    fireEvent.click(importButton());

    // the one-mutation contract (AD-15) with the doc's own uuids
    await waitFor(() => expect(world.importCalls).toHaveLength(1));
    const input = (world.importCalls[0] as { input?: { document?: Record<string, unknown> } }).input?.document;
    expect(input).toBeDefined();
    expect((input?.plans as Array<Record<string, unknown>>)[0]).toEqual({
      id: PLAN_ID, topic: "软工备考", goal: "考试就绪", createdAt: "2026-10-01T00:00:00.000Z",
    }); // nodeIds/materialIds stripped — the associations realize them
    expect((input?.materials as Array<Record<string, unknown>>)[0]).toMatchObject({ id: PDF_ID, kind: "pdf", sizeBytes: 2048 });

    // success: the marker lands and the re-attach invite shows
    await screen.findByText(zh("import.reattachTitle"));

    // the rollback substrate is byte-identical (AD-20 — never deleted/renamed)
    expect(localStorage.getItem(LOCAL_DOC_KEY)).toBe(rawBefore);
    // the offer is one-time: a fresh mount never shows it again
    expect(shouldOfferImport()).toBe(false);
  });

  it("failure is honest: the error renders, the offer stays, marker unset, retry succeeds", async () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const world = importHarness("network-failure");

    mountImportOffer(world);
    fireEvent.click(importButton());

    await screen.findByText(zh("import.failedGeneric"));
    expect(shouldOfferImport()).toBe(true); // marker unset — the offer stays

    fireEvent.click(importButton()); // retry (the server is idempotent — safe)
    await screen.findByText(zh("import.failedGeneric")); // the retry fails honestly too
    world.setImportMode("success");
    fireEvent.click(importButton()); // and the next attempt succeeds

    await screen.findByText(zh("import.reattachTitle"));
    expect(world.importCalls.length).toBeGreaterThanOrEqual(2);
    expect(shouldOfferImport()).toBe(false);
  });

  it("a VALIDATION_FAILED (foreign uuid) surfaces the code-mapped message, never a silent link", async () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const world = importHarness("validation-failure");

    mountImportOffer(world);
    fireEvent.click(importButton());

    await screen.findByText(zh("import.failedValidation"));
    expect(shouldOfferImport()).toBe(true);
  });

  it("not-now dismisses as the one-time decision (the offer never nags)", async () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const world = importHarness("success");

    mountImportOffer(world);
    fireEvent.click(screen.getByRole("button", { name: zh("import.notNow") }));

    await waitFor(() => expect(screen.queryByText(zh("import.offerTitle"))).not.toBeInTheDocument());
    // the local document survives the dismissal untouched (rollback substrate)
    expect(localStorage.getItem(LOCAL_DOC_KEY)).toBe(JSON.stringify(legacyDoc));
    expect(world.importCalls).toHaveLength(0);
  });
});

describe("ImportOfferDialog — the re-attach invite", () => {
  it("lists the imported (byteless) materials and re-attaches through refreshBytes matched by id", async () => {
    localStorage.setItem(LOCAL_DOC_KEY, JSON.stringify(legacyDoc));
    const world = importHarness("success");
    const putFetch = async () => ({ ok: true, status: 200 });
    global.fetch = putFetch as unknown as typeof fetch;

    mountImportOffer(world);
    fireEvent.click(importButton());
    await screen.findByText(zh("import.reattachTitle"));

    // both materials listed — they arrived byteless
    expect(screen.getByText("讲义.pdf")).toBeInTheDocument();
    expect(screen.getByText("笔记.md")).toBeInTheDocument();

    // re-attach the pdf through the existing presign flow (matched by id)
    const file = new File(["pdf-bytes"], "讲义.pdf", { type: "application/pdf" });
    const inputs = screen.getAllByLabelText(zh("import.reattachAction"));
    fireEvent.change(inputs[0], { target: { files: [file] } });

    await waitFor(() => expect(world.uploadCalls).toHaveLength(1));
    expect((world.uploadCalls[0] as { input?: { materialId?: string } }).input?.materialId).toBe(PDF_ID);
    await waitFor(() => expect(sessionBlobs.has(PDF_ID)).toBe(true));
    // the markdown stays un-attached — honest, no fake success; it renders text-only
    expect(sessionBlobs.has(MD_ID)).toBe(false);
  });
});
