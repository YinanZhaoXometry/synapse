import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One learner's serial journey over the critical flow (S4–S7 plus the FR-1
 * creation front door): register → create a plan through the creation chat →
 * attach a material → read it → claim a section (and watch the score NOT
 * move) → take a choice quiz (and watch the score MOVE) → find the wrong
 * answer in the Mistakes hub.
 *
 * The AI surfaces are answered by the stub provider (e2e/stub-provider.mjs):
 * the proposal and the three choice questions are deterministic, and the
 * questions cite real ids from the assembled context. Tests run in order
 * (serial describe) and re-login through the UI — browser contexts do not
 * share localStorage, the account persists server-side.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MATERIAL_PATH = path.join(here, "fixtures", "study-notes.md");

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 学习闭环验证";
// The stub proposal's first two titles (epic-16's fixed 16-node graph —
// e2e/stub-provider.mjs). After confirm the plan home renders the roadmap
// GRAPH by default, so these live in SVG <text>; both stay on-canvas at the
// identity view (columns 0–1, row 0).
const STUB_NODE_TITLES = ["复杂度分析", "二叉树遍历"];

async function registerOrLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/plans/);
}

test.describe.configure({ mode: "serial" });

test.describe("the critical study loop", () => {
  test("the creation chat turns a topic into a confirmed plan (FR-1, stubbed proposal)", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/plans/);

    await page.getByPlaceholder(/COMP5241/).fill(TOPIC);
    await page.getByRole("button", { name: "生成" }).click();

    // The streamed draft (the outline tokens) carries the stub's stage nodes.
    await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(STUB_NODE_TITLES[0]).first()).toBeVisible();
    await page.getByRole("button", { name: "确认创建计划" }).click();

    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: TOPIC })).toBeVisible();
    await expect(page.getByText(STUB_NODE_TITLES[0])).toBeVisible();
    await expect(page.getByText(STUB_NODE_TITLES[1])).toBeVisible();
  });

  test("S4: an attached markdown parses and the reader renders its sections", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // The plan page's queries must settle BEFORE the upload fires — one flaky
    // run saw the attach never leave the client while the page was still
    // settling after navigation. The ring is the Plan query's own payload, so
    // its arrival means the materials list in the same payload has landed too.
    await expect(page.getByRole("img", { name: "掌握度 0%" })).toBeVisible();
    await expect(page.getByText("还没有材料")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(MATERIAL_PATH);

    // Client-side parse lands (the row reports its section count), and the
    // material row opens the reader.
    await expect(page.getByText(/已解析 · \d+ 节/)).toBeVisible();
    await page.locator('a[href*="/read/"]').first().click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/);

    await expect(page.getByRole("heading", { name: "The study loop" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mastery honesty" })).toBeVisible();
  });

  test("S5: claiming a section renders it green and the mastery score does not move (a claim is never evidence)", async ({
    page,
  }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByRole("img", { name: "掌握度 0%" })).toBeVisible();

    await page.locator('a[href*="/read/"]').first().click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/);

    // The claim affordance reveals on heading hover and lives INSIDE the
    // heading element — scope the click to the hovered heading, because every
    // section (including the document title) carries its own claim button.
    const heading = page.getByRole("heading", { name: "The study loop" });
    await heading.hover();
    await heading.getByTestId("marking-claim").click();
    await expect(page.getByTestId("marking-section-tint").first()).toBeVisible();
    await expect(page.getByTestId("marking-unmark").first()).toBeVisible();

    // The reader's back control reads the plan's topic (the material is
    // plan-attached), not the generic 返回计划 label.
    await page.getByRole("button", { name: TOPIC }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByRole("img", { name: "掌握度 0%" })).toBeVisible();
  });

  test("S6: a choice quiz records evidence and moves the mastery score", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // The 出题 quick action opens the launcher dialog; choice mode, whole plan.
    await page.getByRole("button", { name: "出题" }).first().click();
    const launcher = page.getByTestId("quiz-launcher");
    await expect(launcher).toBeVisible();
    await page.getByTestId("quiz-mode-choice").click();
    await page.getByTestId("quiz-scope-plan").click();
    await page.getByTestId("quiz-launcher-start").click();

    // Generation lands (stub-instant) and the session page takes over.
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}\/quiz/, { timeout: 30_000 });
    await expect(page.getByText(/第 1 \/ 3 题/)).toBeVisible();

    // Three questions, correct indices 0/1/2 — answer the middle one wrong
    // on purpose so a mistake exists for S7. Each verdict pins until 下一题.
    const correctPicks = [0, 0, 2];
    for (let i = 0; i < 3; i += 1) {
      await expect(page.getByText(new RegExp(`第 ${i + 1} / 3 题`))).toBeVisible();
      await page.getByTestId(`quiz-option-${correctPicks[i]}`).click();
      await page.getByRole("button", { name: "确认作答" }).click();
      await page.getByRole("button", { name: /下一题|查看结果/ }).click();
    }

    // The results state the evidence honestly.
    await expect(page.getByText("证据已经更新。")).toBeVisible();
    await expect(page.getByText(/答对 2 题/)).toBeVisible();
    await expect(page.getByText(/共 3 题/)).toBeVisible();

    await page.getByRole("button", { name: "返回计划" }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    // The rollup moved off zero — server-computed from the recorded evidence.
    const ring = page.getByRole("img", { name: /掌握度/ });
    await expect(ring).toBeVisible();
    await expect(ring).not.toHaveAttribute("aria-label", "掌握度 0%");
  });

  test("S7: the wrong answer sits in the Mistakes hub with its source", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByRole("link", { name: "错题本" }).click();
    await expect(page).toHaveURL(/\/mistakes/);
    // Router 7 commits route swaps inside a startTransition — the URL flips
    // synchronously while the previous screen can stay mounted until the lazy
    // route chunk resolves. The hub's own heading is the committed-screen
    // signal the question-text assertions below need.
    await expect(page.getByRole("heading", { name: "错因比答案更有用。" })).toBeVisible();

    await expect(page.getByText("Stub question 2: which option is the study answer?")).toBeVisible();
    await expect(page.getByText("你的答案").first()).toBeVisible();
  });
});
