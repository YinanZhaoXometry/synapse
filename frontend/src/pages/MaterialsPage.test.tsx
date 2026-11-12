/**
 * The /materials re-point tests (epic P3-18 T3): the retained page leaves the
 * demo fixtures for the server read — useAllMaterialsQuery (the same
 * materials() surface MistakesPage consumes) renders EVERY row with wire
 * truth only: title, kind label, human-readable sizeBytes, createdAt date,
 * the parseState chip (failed emphasized, its reason on the title attr), and
 * a real scope chip resolved through the label-lookup list reads (plan topic
 * / task node title; unresolvable → chip HIDDEN, never a raw id). Open walks
 * the existing reader deep link (/read/:materialId); the upload button is an
 * honest pointer CTA to attach-in-plan (no upload flow on the hub). The kind
 * filter (all / pdf / markdown) replaces the demo tag row; search keeps
 * matching titles; server-empty vs filter-empty are distinct honest states.
 *
 * Apollo-level stub (the harness double): handlers answer the materials read
 * plus the plans/tasks label lookups with wire-shaped factory fixtures. The
 * demo fixture (MATERIALS) retires with the page — asserted by the demo copy
 * never rendering again (the independent source; the retired i18n keys are
 * gone from the dictionary, so the literals are asserted directly).
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import type { EchoFixture } from "@/test/apollo-harness";
import MaterialsPage from "./MaterialsPage";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhVars = (key: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), zh(key));

const NOW = "2026-11-01T00:00:00Z";
const PLAN_1 = "plan-1";
const TASK_1 = "task-1";
const TASK_NODE = "task-node-1";
const MAT_PDF = "m-pdf";
const MAT_MD = "m-md";
const MAT_FAILED = "m-failed";
const MAT_ORPHAN = "m-orphan";

const material = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "Material",
  origin: "uploaded",
  generation: null,
  id: "m-x",
  title: "材料",
  kind: "markdown",
  sizeBytes: 64,
  planId: null,
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: NOW,
  downloadUrl: null,
  sections: [],
  ...over,
});

const node = (over: Record<string, unknown>): EchoFixture => ({
  __typename: "KnowledgeNode",
  id: "n-x",
  planId: null,
  taskId: null,
  stage: "apply",
  title: "节点",
  description: null,
  optional: false,
  order: 0,
  masteryScore: "0",
  state: "uncovered",
  createdAt: NOW,
  ...over,
});

/** The factory library (server order): a plan-attached parsed pdf, a
 * task-attached parsed md, a failed-parse pdf (plan-attached), and an
 * orphaned pdf whose plan no longer resolves (chip must hide). */
const materials: EchoFixture[] = [
  material({ id: MAT_PDF, title: "Lecture05.pdf", kind: "pdf", sizeBytes: 2097152, planId: PLAN_1, createdAt: "2026-11-01T00:00:00Z", sections: [{ __typename: "MaterialSection", id: "sec-1", title: "测试策略", text: "…" }] }),
  material({ id: MAT_MD, title: "复习讲义.md", kind: "markdown", sizeBytes: 15360, taskId: TASK_1, attachmentScope: "node", nodeId: TASK_NODE, createdAt: "2026-10-30T00:00:00Z", sections: [{ __typename: "MaterialSection", id: "sec-2", title: "拥塞控制", text: "…" }] }),
  material({ id: MAT_FAILED, title: "扫描讲义.pdf", kind: "pdf", sizeBytes: 512, planId: PLAN_1, parseState: "failed", parseFailureReason: "corrupt", createdAt: "2026-10-29T00:00:00Z" }),
  material({ id: MAT_ORPHAN, title: "丢失来源.pdf", kind: "pdf", sizeBytes: 1024, planId: "plan-gone", createdAt: "2026-10-28T00:00:00Z" }),
];

const plans: EchoFixture[] = [
  { __typename: "StudyPlan", id: PLAN_1, topic: "软工备考", goal: null, createdAt: NOW, masteryScore: "0", visibility: "private" },
];

const tasks: EchoFixture[] = [
  { __typename: "StudyTask", id: TASK_1, materialId: MAT_MD, nodeId: TASK_NODE, createdAt: NOW, node: node({ id: TASK_NODE, taskId: TASK_1, title: "TCP 拥塞控制" }) },
];

/** Row lookup by the fixture title (rows carry the wire title verbatim). */
function rowOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest("div.group");
  expect(row).toBeTruthy();
  return row as HTMLElement;
}

type LooseHandlers = Record<string, (variables: Record<string, unknown>) => unknown>;

function hubHandlers(rows: EchoFixture[] | { error: true }): LooseHandlers {
  return {
    Materials: rows instanceof Array ? () => rows : () => {
      // the api's honest error surface
      throw new Error("materials read failed");
    },
    Plans: () => plans,
    Tasks: () => tasks,
  };
}

function renderMaterials(handlers: LooseHandlers) {
  const client = createStubClient(handlers as Record<string, (variables: Record<string, unknown>) => unknown>, {
    sessions: [],
    evidence: [],
    mistakes: [],
    plans: [],
  });
  const Wrapper = makeStubWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter>
        <LanguageProvider>
          <MaterialsPage />
        </LanguageProvider>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("MaterialsPage — the server-backed library (epic P3-18 T3)", () => {
  it("renders every server row with wire truth: title, kind label, human-readable sizeBytes, createdAt date, real count", async () => {
    renderMaterials(hubHandlers(materials));

    // all four titles render (the fixtures', not demo copy)
    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();
    expect(screen.getByText("复习讲义.md")).toBeTruthy();
    expect(screen.getByText("扫描讲义.pdf")).toBeTruthy();
    expect(screen.getByText("丢失来源.pdf")).toBeTruthy();

    // kind labels from the existing keys (scoped to rows — the filter row
    // carries the same label text by design)
    expect(within(rowOf("Lecture05.pdf")).getByText(zh("materials.filePdf"))).toBeTruthy();
    expect(within(rowOf("复习讲义.md")).getByText(zh("materials.fileMd"))).toBeTruthy();

    // human-readable sizes (exact fixture byte counts → exact units)
    expect(within(rowOf("Lecture05.pdf")).getByText(zhVars("materials.sizeMb", { n: "2.0" }))).toBeTruthy();
    expect(within(rowOf("复习讲义.md")).getByText(zhVars("materials.sizeKb", { n: "15.0" }))).toBeTruthy();
    expect(within(rowOf("扫描讲义.pdf")).getByText(zhVars("materials.sizeB", { n: 512 }))).toBeTruthy();

    // createdAt dates render (locale formatting, the MistakesPage pattern)
    expect(within(rowOf("Lecture05.pdf")).getByText(new Date("2026-11-01T00:00:00Z").toLocaleDateString("zh-CN"))).toBeTruthy();
    expect(within(rowOf("丢失来源.pdf")).getByText(new Date("2026-10-28T00:00:00Z").toLocaleDateString("zh-CN"))).toBeTruthy();

    // header carries the real count
    expect(screen.getByText(zhVars("materials.subtitle", { n: 4 }))).toBeTruthy();
  });

  it("opens each row through the existing reader deep link (/read/:materialId)", async () => {
    renderMaterials(hubHandlers(materials));

    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();

    const titles: Record<string, string> = {
      [MAT_PDF]: "Lecture05.pdf",
      [MAT_MD]: "复习讲义.md",
      [MAT_FAILED]: "扫描讲义.pdf",
      [MAT_ORPHAN]: "丢失来源.pdf",
    };
    for (const [id, title] of Object.entries(titles)) {
      const link = screen.getByRole("link", { name: zhVars("materials.openAria", { title }) });
      expect(link.getAttribute("href")).toBe(`/read/${id}`);
    }
  });

  it("filters by kind (all / pdf / markdown) replacing the demo tag row", async () => {
    const user = userEvent.setup();
    renderMaterials(hubHandlers(materials));

    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: zh("materials.filterPdf") }));
    expect(screen.getByText("Lecture05.pdf")).toBeTruthy();
    expect(screen.getByText("扫描讲义.pdf")).toBeTruthy();
    expect(screen.getByText("丢失来源.pdf")).toBeTruthy();
    expect(screen.queryByText("复习讲义.md")).toBeNull();

    await user.click(screen.getByRole("button", { name: zh("materials.filterMd") }));
    expect(screen.queryByText("Lecture05.pdf")).toBeNull();
    expect(screen.getByText("复习讲义.md")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: zh("materials.filterAll") }));
    expect(screen.getByText("Lecture05.pdf")).toBeTruthy();
    expect(screen.getByText("复习讲义.md")).toBeTruthy();
  });

  it("searches titles; a gibberish query shows the DISTINCT filter-empty state (server rows still exist)", async () => {
    const user = userEvent.setup();
    renderMaterials(hubHandlers(materials));

    const search = (await screen.findByRole("searchbox", { name: zh("materials.search") })) as HTMLInputElement;

    await user.type(search, "讲义");
    expect(screen.getByText("复习讲义.md")).toBeTruthy();
    expect(screen.getByText("扫描讲义.pdf")).toBeTruthy();
    expect(screen.queryByText("Lecture05.pdf")).toBeNull();

    await user.type(search, "绝不存在的材料");
    // filter-empty copy, not the server-empty copy — the library is NOT empty
    expect(screen.getByText(zh("materials.filterEmptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("materials.filterEmptyBody"))).toBeTruthy();
    expect(screen.queryByText(zh("materials.emptyTitle"))).toBeNull();

    await user.clear(search);
    expect(screen.getByText("Lecture05.pdf")).toBeTruthy();
    expect(screen.queryByText(zh("materials.filterEmptyTitle"))).toBeNull();
  });

  it("resolves real scope chips: plan topic + task node title; an unresolvable plan hides the chip (never a raw id)", async () => {
    renderMaterials(hubHandlers(materials));

    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();

    // resolvable chips render the resolved titles — plan-1 owns two rows
    expect(screen.getAllByText("软工备考")).toHaveLength(2);
    expect(within(rowOf("复习讲义.md")).getByText("TCP 拥塞控制")).toBeTruthy();

    // the orphan's chip is HIDDEN — the raw id never appears anywhere
    expect(screen.queryByText("plan-gone")).toBeNull();
    expect(rowOf("丢失来源.pdf").querySelector("[data-testid='scope-chip']")).toBeNull();

    // resolvable rows DO carry their chip
    expect(rowOf("Lecture05.pdf").querySelector("[data-testid='scope-chip']")?.textContent).toBe("软工备考");
    expect(rowOf("复习讲义.md").querySelector("[data-testid='scope-chip']")?.textContent).toBe("TCP 拥塞控制");
  });

  it("surfaces parse state honestly: failed emphasized with its reason on hover; parsed carries the section count", async () => {
    renderMaterials(hubHandlers(materials));

    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();

    // failed chip: the emphasized danger treatment + the reason on the title attr
    const failedChip = screen.getByText(zh("plans.parseFailed"));
    expect(failedChip.className).toContain("tint-danger");
    expect(failedChip.getAttribute("title")).toBe(zh("errors.parseCorrupt"));

    // parsed chips carry the honest section count (the PlanHome vocabulary);
    // both parsed fixtures carry one section
    expect(screen.getAllByText(zhVars("plans.parseParsed", { n: 1 }))).toHaveLength(2);
  });

  it("server-empty → the honest attach-in-plan empty state (never a demo fallback)", async () => {
    renderMaterials(hubHandlers([]));

    expect(await screen.findByText(zh("materials.emptyTitle"))).toBeTruthy();
    expect(screen.getByText(zh("materials.emptyBody"))).toBeTruthy();
    expect(screen.queryByText(zh("materials.filterEmptyTitle"))).toBeNull();

    // demo residue absent: the RETIRED fixture copy never renders again (the
    // fixture and its i18n keys are gone — the literals are the source)
    expect(screen.queryByText("COMP5241 Lecture 4 — 软件设计")).toBeNull();
    expect(screen.queryByText("课程")).toBeNull();
    expect(screen.queryByText("备考")).toBeNull();
  });

  it("read error → the honest failure card with retry (never fake rows)", async () => {
    renderMaterials(hubHandlers({ error: true }));

    expect(await screen.findByText(zh("materials.loadFailed"))).toBeTruthy();
    expect(screen.getByRole("button", { name: zh("materials.retry") })).toBeTruthy();
    expect(screen.queryByText("Lecture05.pdf")).toBeNull();
  });

  it("the upload button is an honest pointer CTA to attach-in-plan (a /plans link, not a toast stub)", async () => {
    renderMaterials(hubHandlers(materials));

    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();

    const pointer = screen.getByRole("link", { name: zh("materials.upload") });
    expect(pointer.getAttribute("href")).toBe("/plans");
    // the honest hint rides beside it, and the retired toast stub never renders
    expect(screen.getByText(zh("materials.uploadHint"))).toBeTruthy();
    expect(screen.queryByText("请在学习计划或任务中附加材料。")).toBeNull();
  });

  it("the first paint of a loading page shows the shared PageLoader — never blank, never stale copy (epic-28 T3)", () => {
    const { container } = renderMaterials(hubHandlers(materials));
    // the stub link resolves on the next tick — the first paint waits
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(zh("common.loading"))).toBeTruthy();
    expect(screen.queryByText(zh("materials.emptyTitle"))).toBeNull();
    expect(screen.queryByText("Lecture05.pdf")).toBeNull();
  });

  it("fires the retry refetch after a read error and recovers", async () => {
    let fail = true;
    const handlers = hubHandlers(materials);
    const client = createStubClient(
      {
        ...handlers,
        Materials: () => {
          if (fail) throw new Error("materials read failed");
          return materials;
        },
      } as Record<string, (variables: Record<string, unknown>) => unknown>,
      { sessions: [], evidence: [], mistakes: [], plans: [] },
    );
    const Wrapper = makeStubWrapper(client);
    render(
      <Wrapper>
        <MemoryRouter>
          <LanguageProvider>
            <MaterialsPage />
          </LanguageProvider>
        </MemoryRouter>
      </Wrapper>,
    );

    expect(await screen.findByText(zh("materials.loadFailed"))).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: zh("materials.retry") }));
    expect(await screen.findByText("Lecture05.pdf")).toBeTruthy();
  });
});
