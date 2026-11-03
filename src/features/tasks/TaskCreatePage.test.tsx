import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { loadDb } from "@/data";
import TaskCreatePage from "./TaskCreatePage";

/**
 * TaskCreatePage observable states (T1; spec testing seam 4 — component render
 * seam): idle, bilingual invalid-file rejection, valid upload progressing to
 * creation and landing in the Reader. Everything below the page's hook
 * boundaries is real — the shipped repositories over localStorage and the
 * reader's eager-parse hook — so the walk exercises the production seams
 * (prior art: the reader's use-reading-position.test.tsx harness). Expected
 * copy reads the copy deck directly (independent source, never recomputed);
 * the stub reader route captures the landing instead of mounting pdfjs.
 */

/**
 * jsdom 20's File predates .arrayBuffer(), which the parse seam (and the
 * browser runtime it mirrors) reads bytes through. The reader-loop prior art
 * hands Node's Blob to the registry directly; here the File legitimately
 * arrives through the input element, so the prototype is bridged instead —
 * with the FileReader the same jsdom provides — letting the production path
 * run unmodified.
 */
beforeAll(() => {
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function (this: File): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

const zh = (key: string) => (translations as Record<string, Record<string, string>>).zh[key];

function ReaderLanding() {
  const { materialId } = useParams();
  return <p data-testid="reader-landing">{materialId}</p>;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/task/new"]}>
          <Toaster />
          <Routes>
            <Route path="/task/new" element={<TaskCreatePage />} />
            <Route path="/read/:materialId" element={<ReaderLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

const fileInputOf = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;

const markdownFile = (name: string) =>
  new File([new TextEncoder().encode("# Hello\n\nBody paragraph for study.")], name, {
    type: "text/markdown",
  });

beforeEach(() => {
  localStorage.clear();
});

describe("TaskCreatePage (FR-37; UJ-6; AD-6/7/8)", () => {
  it("idle: offers the single-file upload with the shared constraint hint, no confirm yet, nothing registered", () => {
    renderPage();
    expect(screen.getByText(zh("tasks.uploadCta"))).toBeInTheDocument();
    expect(screen.getByText(zh("tasks.uploadHint"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: zh("tasks.confirm") })).not.toBeInTheDocument();
    expect(loadDb().tasks).toHaveLength(0);
    expect(loadDb().materials).toHaveLength(0);
  });

  it("rejects an unsupported type with the bilingual reason and registers nothing", async () => {
    const { container } = renderPage();
    const file = new File(["plain text"], "slides.txt", { type: "text/plain" });
    fireEvent.change(fileInputOf(container), { target: { files: [file] } });

    // the toast is an observable state — sonner renders it asynchronously
    expect(await screen.findByText(zh("errors.uploadUnsupportedType"))).toBeInTheDocument();
    expect(loadDb().materials).toHaveLength(0);
    expect(loadDb().tasks).toHaveLength(0);
  });

  it("rejects an over-cap file with the bilingual reason and registers nothing", async () => {
    const { container } = renderPage();
    const oversized = new File([new ArrayBuffer(20 * 1024 * 1024 + 1)], "huge.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInputOf(container), { target: { files: [oversized] } });

    expect(await screen.findByText(zh("errors.uploadTooLarge"))).toBeInTheDocument();
    expect(loadDb().materials).toHaveLength(0);
    expect(loadDb().tasks).toHaveLength(0);
  });

  it("creating: the name pre-fills from the filename and is editable; confirming shows the creating state", async () => {
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
    const materialId = await waitFor(() => {
      const landed = screen.getByTestId("reader-landing").textContent;
      expect(landed).toBeTruthy();
      return landed as string;
    });

    // exactly one Material registered against the task, one task, one auto node (AD-6)
    const db = loadDb();
    expect(db.materials).toHaveLength(1);
    expect(db.materials[0].id).toBe(materialId);
    expect(db.materials[0].title).toBe("我的讲义");
    expect(db.tasks).toHaveLength(1);
    const task = db.tasks[0];
    expect(task.materialId).toBe(materialId);
    expect(db.materials[0].taskId).toBe(task.id);
    const owned = db.nodes.filter((n) => n.taskId === task.id);
    expect(owned).toHaveLength(1);
    expect(owned[0].planId).toBeNull();
    expect(owned[0].title).toBe("我的讲义"); // the node is titled from the material (AD-6)

    // the eager parse ran through the reader's public API to its honest end state (AD-7)
    await waitFor(() => {
      expect(loadDb().materials[0].parseState).toBe("parsed");
    });
  });

  it("confirming with a blank name falls back to the filename-derived title", async () => {
    const { container } = renderPage();
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("paper-draft.md")] } });
    const nameInput = screen.getByLabelText(zh("tasks.nameLabel")) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: zh("tasks.confirm") }));

    await waitFor(() => expect(screen.getByTestId("reader-landing")).toBeInTheDocument());
    expect(loadDb().materials[0].title).toBe("paper-draft");
  });
});
