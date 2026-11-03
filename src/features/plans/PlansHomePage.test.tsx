import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createPlan, createStudyTask, registerMaterial, saveReadingProgress } from "@/data";
import type { MaterialSection, ParseState } from "@/domain/entities";
import PlansHomePage from "./PlansHomePage";

/**
 * PlansHomePage observable states (T3; FR-37; AD-8/9; spec testing seam 4 —
 * component render seam): the pitch + create-task entry in the empty state,
 * the create-task entry persisting next to create-new when plans exist, the
 * Study Tasks section rendering only when ≥ 1 task exists (no empty chrome),
 * rows carrying title + single-node ring + working task-home and
 * continue-reading links. Data seeds through the real repository write paths
 * (registerMaterial → createStudyTask — TaskHomePage.test.tsx precedent);
 * expected copy reads the dictionary directly (independent source, never
 * recomputed); stub routes capture navigation instead of mounting pages.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhN = (key: string, n: number | string) => zh(key).replace("{n}", String(n));

function PlanNewLanding() {
  return <p data-testid="plan-new-landing" />;
}
function TaskNewLanding() {
  return <p data-testid="task-new-landing" />;
}
function ReaderLanding() {
  return <p data-testid="reader-landing" />;
}

function renderPlansHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/plans"]}>
          <Routes>
            <Route path="/plans" element={<PlansHomePage />} />
            <Route path="/plan/new" element={<PlanNewLanding />} />
            <Route path="/task/new" element={<TaskNewLanding />} />
            <Route path="/read/:materialId" element={<ReaderLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

function seedPlan(topic: string) {
  return createPlan({ topic, goal: null, nodes: [{ title: "node-1", stage: null }] }).plan;
}

interface SeedOptions {
  kind?: "pdf" | "markdown";
  sections?: MaterialSection[];
  parseState?: ParseState;
}

/** A task seeded through the real creation path: register material → createStudyTask. */
function seedTask(title: string, options: SeedOptions = {}) {
  const { material } = registerMaterial({
    title,
    kind: options.kind ?? "markdown",
    sizeBytes: 2048,
    planId: null,
    taskId: null,
    sections: options.sections ?? [{ id: "intro", title: "Intro", text: "intro text" }],
    parseState: options.parseState ?? "parsed",
  });
  const { task, node } = createStudyTask({ materialId: material.id });
  return { task, material, node };
}

const entryButton = () => screen.getByRole("button", { name: new RegExp(zh("tasks.createEntry")) });
const sectionHeading = () => screen.queryByRole("heading", { name: zh("tasks.eyebrow") });

beforeEach(() => {
  localStorage.clear();
});

describe("PlansHomePage — create-task entries (FR-37; AD-8; UJ-6)", () => {
  it("empty state: the pitch and the create-task entry sit alongside the creation chat, no create-new", async () => {
    renderPlansHome();

    // the pitch copy (UX spine microcopy, verbatim key) + the entry beside the chat
    expect(await screen.findByText(zh("tasks.pitch"))).toBeInTheDocument();
    expect(entryButton()).toBeInTheDocument();
    // the creation chat is still the primary surface (existing behavior)
    expect(screen.getByPlaceholderText(zh("plans.topicPlaceholder"))).toBeInTheDocument();
    // empty state keeps hiding create-new (existing behavior unchanged)
    expect(screen.queryByRole("button", { name: new RegExp(zh("plans.createNew")) })).not.toBeInTheDocument();
    // zero tasks → no section chrome
    expect(sectionHeading()).not.toBeInTheDocument();
  });

  it("empty-state create-task entry navigates to the creation route /task/new", async () => {
    renderPlansHome();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(zh("tasks.createEntry")) }));
    expect(await screen.findByTestId("task-new-landing")).toBeInTheDocument();
  });

  it("plans-exist state: the create-task entry persists next to create-new; zero tasks → no section", async () => {
    seedPlan("软件工程备考");
    renderPlansHome();

    expect(await screen.findByRole("button", { name: new RegExp(zh("plans.createNew")) })).toBeInTheDocument();
    expect(entryButton()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: zh("plans.returningTitle") })).toBeInTheDocument();
    expect(sectionHeading()).not.toBeInTheDocument();
  });

  it("plans-exist create-new still navigates to /plan/new (existing behavior unchanged)", async () => {
    seedPlan("软件工程备考");
    renderPlansHome();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(zh("plans.createNew")) }));
    expect(await screen.findByTestId("plan-new-landing")).toBeInTheDocument();
  });
});

describe("PlansHomePage — Study Tasks section (FR-37; FR-10; UJ-6)", () => {
  it("with ≥ 1 task: rows of title + single-node ring, a task-home link (no dead link), and a continue-reading link", async () => {
    seedPlan("软件工程备考");
    const { task, material } = seedTask("lecture-04");
    renderPlansHome();

    // the section appears with its heading
    expect(await screen.findByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    // the row carries the material's title and links to the task home route
    const taskLink = await screen.findByRole("link", { name: new RegExp("lecture-04") });
    expect(taskLink).toHaveAttribute("href", `/task/${task.id}`);
    // the row's single-node mastery ring reads the honest uncovered 0 (AD-6, no evidence)
    expect(within(taskLink).getByRole("img", { name: zhN("plans.masteryAria", 0) })).toBeInTheDocument();
    // no stored position → the plain reader link, labelled 打开 (not 继续)
    const openLink = await screen.findByRole("link", { name: new RegExp(zh("common.open")) });
    expect(openLink).toHaveAttribute("href", `/read/${material.id}`);
  });

  it("the continue-reading link deep-links into the reader at the stored position (?page=N)", async () => {
    seedPlan("软件工程备考");
    const { task, material } = seedTask("paper", {
      kind: "pdf",
      sections: [
        { id: "page-1", title: "p1", text: "a" },
        { id: "page-3", title: "p3", text: "b" },
      ],
    });
    saveReadingProgress(material.id, { locator: { kind: "pdf", page: 3 }, text: "page three text" });
    renderPlansHome();

    expect(await screen.findByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: new RegExp("paper") })).toHaveAttribute("href", `/task/${task.id}`);
    const continueLink = await screen.findByRole("link", { name: new RegExp(zh("plans.continueReading")) });
    expect(continueLink).toHaveAttribute("href", `/read/${material.id}?page=3`);
  });

  it("tasks render even with zero plans — the empty state carries the section too", async () => {
    const { task } = seedTask("solo-notes");
    renderPlansHome();

    // still the empty state (pitch + chat), plus the task section
    expect(await screen.findByText(zh("tasks.pitch"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(zh("plans.topicPlaceholder"))).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: zh("tasks.eyebrow") })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: new RegExp("solo-notes") })).toHaveAttribute(
      "href",
      `/task/${task.id}`,
    );
  });
});
