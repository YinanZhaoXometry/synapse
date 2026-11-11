import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The AI 讲义 critical flows (epic-36 T3): the TWO lesson entries end-to-end
 * over the stub provider's deterministic lesson replies (stub-provider.mjs —
 * outline JSON citing real section ids, per-chapter Markdown fills):
 *
 *   (a) the NODE path (②): plan creation with a file → proposals confirmed →
 *       the node sheet's 「生成讲义」 creates the lesson (one outline call)
 *       → the reader streams both chapters ready → the section-end source
 *       line clicks through to the original reader (AD-8 anchor channel).
 *   (b) the MATERIAL path (①): the Materials hub row's 「生成讲义」 → the
 *       READ-ONLY outline confirm popover (chapters + source sections + the
 *       estimate-cost line) → 「重出一版」 re-rolls silently → 「确认生成」
 *       echoes the outline into createLesson → the reader's ?generate=1
 *       one-shot fills the chapters → the hub shows the AI 讲义 chip and the
 *       source row deforms into 「打开讲义」 (the per-source singleton).
 *
 * Fresh registered user per test (the harness convention — tests self-
 * isolate through the shared dev database).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MATERIAL_PATH = path.join(here, "fixtures", "study-notes.md");

const PASSWORD = "e2e-password-123";
const TOPIC = "E2E 讲义生成验证";
const FIRST_NODE = "复杂度分析";
// The fixture's section headings (the source-line click-through asserts the
// original reader renders them again).
const SOURCE_SECTION = "The study loop";
const MATERIAL_TITLE = "study-notes";

function nodeBox(page: Page, title: string) {
  return page.locator(`[data-testid="roadmap-node"][aria-label*="${title}"]`);
}

/** Register a fresh account and land on Plans Home. */
async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page).toHaveURL(/\/plans/);
}

/** Create a plan WITH the staged file and wait for the attach+parse to land
 * (the row reports its section count) + the auto-mapping call to fire. */
async function createPlanWithMaterial(page: Page, email: string) {
  await register(page, email);
  await page.locator('input[type="file"][multiple]').setInputFiles(MATERIAL_PATH);
  await expect(page.getByTestId("creation-staged-files")).toBeVisible();
  await page.getByPlaceholder(/COMP5241/).fill(TOPIC);
  await page.getByRole("button", { name: "生成" }).click();
  await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
  const mapResponsePromise = page.waitForResponse(
    (response) =>
      response.request().postData()?.includes("mapMaterialSections") === true &&
      response.url().includes("/graphql"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "确认创建计划" }).click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
  await expect(page.getByText(/已解析 · \d+ 节/)).toBeVisible({ timeout: 30_000 });
  const mapResponse = await mapResponsePromise;
  const mapPayload = await mapResponse.json();
  expect(mapPayload.data?.mapMaterialSections?.mappings?.length ?? 0).toBeGreaterThan(0);
}

test.describe.configure({ mode: "serial" });

test.describe("the AI 讲义 flows (epic-36 T3)", () => {
  test("(a) node 生成讲义 → the reader fills both chapters → the source line clicks through to the original", async ({
    page,
  }) => {
    const EMAIL = `e2e-lesson-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
    await createPlanWithMaterial(page, EMAIL);

    // The ② create needs CONFIRMED mappings (an unmapped node refuses) —
    // confirm the auto-mapping proposals in the coverage panel (one proposed
    // group under the stub's first node); the rows move to the 已映射 group.
    await page.getByRole("button", { name: "内容覆盖" }).click();
    const panel = page.getByTestId("coverage-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "全部接受" }).first().click();
    await expect(panel.getByText("已映射")).toBeVisible({ timeout: 30_000 });

    // The node sheet's 生成讲义 (T2's entry — the shell creates and drops us
    // into the reader with the one-shot ?generate=1 command).
    await nodeBox(page, FIRST_NODE).click();
    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("node-lesson").click();

    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/, { timeout: 30_000 });
    // The lesson face assembles itself in front of us: both stub chapters
    // stream to ready (placeholder → spinner → prose).
    await expect(page.getByTestId("lesson-section-ready")).toHaveCount(2, { timeout: 60_000 });
    // Each ready section ends with its source line into the ORIGINAL reader.
    const sourceLines = page.getByTestId("lesson-source-line");
    await expect(sourceLines.first()).toBeVisible();
    await expect(page.getByTestId("lesson-source-link").first()).toBeVisible();

    // The click-through (AD-8): the source line lands on the original
    // material's reader at the anchored section.
    await page.getByTestId("lesson-source-link").first().click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: SOURCE_SECTION })).toBeVisible({ timeout: 30_000 });
  });

  test("(b) material 生成讲义 → outline confirm → 确认生成 → reader chapters ready → hub chips + singleton deform", async ({
    page,
  }) => {
    const EMAIL = `e2e-lesson-material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
    await createPlanWithMaterial(page, EMAIL);

    // The hub row action (①): the parsed row offers 生成讲义 (a fresh user —
    // exactly one material row).
    await page.getByRole("link", { name: "学习资料" }).click();
    await expect(page).toHaveURL(/\/materials/);
    const row = page.locator("div.group").filter({ hasText: MATERIAL_TITLE }).first();
    await expect(row.getByTestId("material-lesson")).toBeVisible();
    await expect(row.getByTestId("material-lesson")).toHaveText("生成讲义");
    await row.getByTestId("material-lesson").click();

    // The READ-ONLY outline gate: the propose call lands (1 cap-counted
    // call), the popover names the chapters with their source sections and
    // the estimate-cost line — and carries no editor affordance.
    const popover = page.getByTestId("lesson-outline-confirm");
    await expect(popover).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lesson-outline-chapter")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByTestId("lesson-outline-chapter").first()).toContainText("基础梳理");
    await expect(page.getByTestId("lesson-outline-cost")).toBeVisible();
    expect(await page.getByTestId("lesson-outline-confirm").locator('input, textarea, [contenteditable="true"]').count()).toBe(0);

    // 重出一版: one more call, the content replaced silently (no toast, no
    // editor — the popover stays with the fresh outline).
    await page.getByTestId("lesson-outline-reroll").click();
    await expect(page.getByTestId("lesson-outline-chapter")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByTestId("lesson-outline-cost")).toBeVisible();

    // 确认生成: the echo → createLesson (no provider call) → the reader's
    // one-shot ?generate=1 fills both chapters.
    await page.getByTestId("lesson-outline-confirm-btn").click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByTestId("lesson-section-ready")).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByTestId("lesson-source-line").first()).toBeVisible();

    // Back at the hub: the lesson row carries the AI 讲义 chip, and the
    // SOURCE row's action has deformed into 打开讲义 (the per-source
    // singleton — a repeat entry opens, never creates). The ① lesson's title
    // equals its source's, so the rows are discriminated structurally: the
    // lesson row holds the origin chip, the source row the 已解析 · 3 节 chip.
    await page.getByRole("link", { name: "学习资料" }).click();
    await expect(page).toHaveURL(/\/materials/);
    const lessonRow = page.locator("div.group").filter({ has: page.getByTestId("lesson-origin-chip") });
    await expect(lessonRow).toHaveCount(1, { timeout: 30_000 });
    const sourceRow = page
      .locator("div.group")
      .filter({ has: page.getByTestId("material-lesson") })
      .filter({ hasText: "已解析 · 3 节" });
    await expect(sourceRow).toHaveCount(1);
    await expect(sourceRow.getByTestId("material-lesson")).toHaveText("打开讲义");
  });
});
