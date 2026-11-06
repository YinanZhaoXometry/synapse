import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachMaterialDocument,
  CreateMaterialUploadDocument,
  CreateTaskDocument,
  MaterialsDocument,
  TasksDocument,
} from "@/types/graphql";
import { sessionBlobs } from "@/api";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import TaskCreatePage from "./TaskCreatePage";

/**
 * TaskCreatePage observable states (T1; spec testing seam 4 — component render
 * seam over MockedProvider, the cutover's Apollo test seam): idle, bilingual
 * invalid-file rejection, valid upload progressing through the two-step upload
 * (attach → presigned PUT → createTask) and landing in the Reader. The Apollo
 * boundary is mocked server-shaped (fixtures off the generated fragment types,
 * `__typename` everywhere an id lives); the reader's eager-parse hook is
 * stubbed to a spy so the walk asserts the page's OWN contract — the parse
 * kick against the bound row — without coupling to the reader's in-flight
 * internals. Expected copy reads the copy deck directly (independent source,
 * never recomputed); the stub reader route captures the landing instead of
 * mounting pdfjs.
 */

// The eager-parse spy: one seam override — the page binds the hook to the
// attached row; the stub records the binding and the mutate calls.
const parseSeam = vi.hoisted(() => ({ bound: [] as unknown[], calls: [] as string[] }));

vi.mock("@/features/reader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reader")>();
  return {
    ...actual,
    useParseMaterialMutation: (material: unknown) => {
      parseSeam.bound.push(material);
      return {
        mutate: (materialId: string) => {
          parseSeam.calls.push(materialId);
        },
      };
    },
  };
});

const zh = (key: string) => (translations as Record<string, Record<string, string>>).zh[key];

function ReaderLanding() {
  const { materialId } = useParams();
  return <p data-testid="reader-landing">{materialId}</p>;
}

// ---- server-shaped fixtures (the mock data is what the api would return) ----

const MATERIAL_ID = "m-1";
const TASK_ID = "t-1";
const NODE_ID = "n-1";

const attachedMaterial = (title: string) => ({
  __typename: "Material",
  id: MATERIAL_ID,
  title,
  kind: "markdown",
  sizeBytes: 2048,
  planId: null,
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "pending",
  parseFailureReason: null,
  createdAt: "2026-11-04T00:00:00Z",
  downloadUrl: null,
  sections: [],
});

const createdTask = (materialId: string) => ({
  __typename: "CreateTaskPayload",
  task: {
    __typename: "StudyTask",
    id: TASK_ID,
    materialId,
    nodeId: NODE_ID,
    createdAt: "2026-11-04T00:00:01Z",
  },
  node: {
    __typename: "KnowledgeNode",
    id: NODE_ID,
    planId: null,
    taskId: TASK_ID,
    stage: null,
    title: "lecture-04",
    description: null,
    optional: false,
    order: 0,
    masteryScore: "0",
    state: "uncovered",
    createdAt: "2026-11-04T00:00:01Z",
  },
});

// Mutation variables carry randomly minted clientUuids (AD-12) — the mocks
// match on a variables FUNCTION and capture the inputs for the assertions.
interface AttachInputShape {
  title: string;
  kind: string;
  planId: string | null;
  taskId: string | null;
}
interface CreateTaskInputShape {
  clientUuid: string;
  materialId: string;
}
let attachInputs: AttachInputShape[] = [];
let createTaskInputs: CreateTaskInputShape[] = [];

function mocks(options: { failFirstCreate?: boolean } = {}) {
  attachInputs = [];
  createTaskInputs = [];
  return [
    {
      request: {
        query: AttachMaterialDocument,
        variables: (vars) => {
          attachInputs.push(vars.input);
          return true;
        },
      },
      result: (vars) => ({
        data: { __typename: "Mutation", attachMaterial: { __typename: "AttachMaterialPayload", material: attachedMaterial(vars.input.title) } },
      }),
      maxUsageCount: 5,
    },
    {
      request: { query: CreateMaterialUploadDocument, variables: () => true },
      result: {
        data: {
          __typename: "Mutation",
          createMaterialUpload: {
            __typename: "CreateMaterialUploadPayload",
            materialId: MATERIAL_ID,
            uploadUrl: "http://storage.test/put",
            expiresAt: "2026-11-04T01:00:00Z",
          },
        },
      },
      maxUsageCount: 5,
    },
    ...(options.failFirstCreate
      ? [
          {
            request: {
              query: CreateTaskDocument,
              variables: (vars) => {
                createTaskInputs.push(vars.input);
                return true;
              },
            },
            error: new Error("create failed"),
          },
        ]
      : []),
    {
      request: {
        query: CreateTaskDocument,
        variables: (vars) => {
          createTaskInputs.push(vars.input);
          return true;
        },
      },
      result: (vars) => ({ data: { __typename: "Mutation", createTask: createdTask(vars.input.materialId) } }),
      maxUsageCount: 5,
    },
    // createTask's refetch sweep (the tasks list + the material back-link view)
    { request: { query: TasksDocument, variables: () => true }, result: { data: { tasks: [] } }, maxUsageCount: 5 },
    { request: { query: MaterialsDocument, variables: () => true }, result: { data: { materials: [] } }, maxUsageCount: 5 },
  ];
}

function renderPage(options: { failFirstCreate?: boolean } = {}) {
  return render(
    <LanguageProvider>
      <MockedProvider mocks={mocks(options)}>
        <MemoryRouter initialEntries={["/task/new"]}>
          <Toaster />
          <Routes>
            <Route path="/task/new" element={<TaskCreatePage />} />
            <Route path="/read/:materialId" element={<ReaderLanding />} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>
    </LanguageProvider>,
  );
}

const fileInputOf = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

const markdownFile = (name: string) =>
  new File([new TextEncoder().encode("# Hello\n\nBody paragraph for study.")], name, {
    type: "text/markdown",
  });

beforeEach(() => {
  // jsdom's Crypto predates randomUUID — the AD-12 mint is stubbed with the
  // same interface (the values themselves are never asserted).
  vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) });
  // the presigned PUT goes straight to storage (never through the api) — a
  // plain ok response stands in for the provider
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200 })),
  );
  parseSeam.bound.length = 0;
  parseSeam.calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskCreatePage (FR-37; UJ-6; AD-6/7/8)", () => {
  it("idle: offers the single-file upload with the shared constraint hint, no confirm yet", () => {
    renderPage();
    expect(screen.getByText(zh("tasks.uploadCta"))).toBeInTheDocument();
    expect(screen.getByText(zh("tasks.uploadHint"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: zh("tasks.confirm") })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(zh("tasks.nameLabel"))).not.toBeInTheDocument();
  });

  it("rejects an unsupported type with the bilingual reason and attaches nothing", async () => {
    const { container } = renderPage();
    const file = new File(["plain text"], "slides.txt", { type: "text/plain" });
    fireEvent.change(fileInputOf(container), { target: { files: [file] } });

    // the toast is an observable state — sonner renders it asynchronously
    expect(await screen.findByText(zh("errors.uploadUnsupportedType"))).toBeInTheDocument();
    expect(attachInputs).toHaveLength(0);
    expect(screen.queryByTestId("reader-landing")).not.toBeInTheDocument();
  });

  it("rejects an over-cap file with the bilingual reason and attaches nothing", async () => {
    const { container } = renderPage();
    const oversized = new File([new ArrayBuffer(20 * 1024 * 1024 + 1)], "huge.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInputOf(container), { target: { files: [oversized] } });

    expect(await screen.findByText(zh("errors.uploadTooLarge"))).toBeInTheDocument();
    expect(attachInputs).toHaveLength(0);
  });

  it("creating: the name pre-fills from the filename and is editable; confirming rides attach → createTask → the Reader", async () => {
    const { container } = renderPage();
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("lecture-04.md")] } });

    // the name input pre-fills from the filename (T1 AC)
    const nameInput = screen.getByLabelText(zh("tasks.nameLabel")) as HTMLInputElement;
    expect(nameInput.value).toBe("lecture-04");
    // and is editable before confirming
    fireEvent.change(nameInput, { target: { value: "我的讲义" } });

    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));

    // the creating state is observable before the async chain resolves
    expect(screen.getByRole("button", { name: zh("tasks.creating") })).toBeDisabled();

    // the user lands in the Reader on the created material (UJ-6; AD-8)
    await waitFor(() => expect(screen.getByTestId("reader-landing")).toHaveTextContent(MATERIAL_ID));

    // exactly one attach against the task-to-be: the edited title, taskId null
    // (the material cannot know the task yet), markdown kind (AD-6 flow)
    expect(attachInputs).toHaveLength(1);
    expect(attachInputs[0].title).toBe("我的讲义");
    expect(attachInputs[0].kind).toBe("markdown");
    expect(attachInputs[0].taskId).toBeNull();
    expect(attachInputs[0].planId).toBeNull();
    // createTask back-links the attached material (its single auto-node is
    // server-owned — AD-6); the idempotency key rides per call (AD-12)
    expect(createTaskInputs).toHaveLength(1);
    expect(createTaskInputs[0].materialId).toBe(MATERIAL_ID);
    expect(typeof createTaskInputs[0].clientUuid).toBe("string");
    // the bytes are parked in the session registry for this session's reader
    expect(sessionBlobs.has(MATERIAL_ID)).toBe(true);
    // the eager parse kicked against the bound row (AD-7)
    expect(parseSeam.calls).toContain(MATERIAL_ID);
  });

  it("confirming with a blank name falls back to the filename-derived title", async () => {
    const { container } = renderPage();
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("paper-draft.md")] } });
    const nameInput = screen.getByLabelText(zh("tasks.nameLabel")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));

    await waitFor(() => expect(screen.getByTestId("reader-landing")).toBeInTheDocument());
    expect(attachInputs[0].title).toBe("paper-draft");
  });

  it("create-task failure then retry reuses the attached material — one attach, no orphan duplicate", async () => {
    const { container } = renderPage({ failFirstCreate: true });
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("retry-case.md")] } });

    // attempt 1: the material attaches, task creation fails
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));
    await waitFor(() => expect(createTaskInputs).toHaveLength(1));
    expect(attachInputs).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: zh("tasks.confirm") })).toBeEnabled());

    // retry skips straight to task creation on the SAME material
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));
    await waitFor(() => expect(screen.getByTestId("reader-landing")).toBeInTheDocument());

    expect(attachInputs).toHaveLength(1); // never attached twice
    expect(createTaskInputs).toHaveLength(2);
    expect(createTaskInputs[1].materialId).toBe(createTaskInputs[0].materialId);
    // the eager parse ran once against the bound row — the retry never re-parses
    expect(parseSeam.calls).toHaveLength(1);
  });

  it("choosing a different file after a failed attempt attaches the new file, not a stale reuse", async () => {
    const { container } = renderPage({ failFirstCreate: true });
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("first.md")] } });
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));
    await waitFor(() => expect(createTaskInputs).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: zh("tasks.confirm") })).toBeEnabled());

    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("second.md")] } });
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));
    await waitFor(() => expect(screen.getByTestId("reader-landing")).toBeInTheDocument());

    expect(attachInputs).toHaveLength(2); // one per file — the stale id is not reused
    expect(attachInputs[1].title).toBe("second");
    expect(createTaskInputs).toHaveLength(2);
    expect(screen.getByTestId("reader-landing")).toHaveTextContent(MATERIAL_ID);
  });
});
