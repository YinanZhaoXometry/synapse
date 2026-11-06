import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The deterministic destinations beyond the core loop (S4–S7 live in
 * study-loop.spec.ts): publish + fork on the Square, the study-task → plan
 * promotion, the account settings (password change, data export, logout), and
 * the retained ten-destination nav promise. AI-gated surfaces (companion,
 * quick test, open/mix quiz, notes, flashcard generation) are deliberately
 * NOT here — the stub provider answers only the proposal and choice-quiz
 * shapes; everything in this file is deterministic product behavior.
 *
 * The fork journey is serial (T1 publishes what T2 forks); the rest stand
 * alone. Every test registers its own fresh user — no shared browser state.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MATERIAL_PATH = path.join(here, "fixtures", "study-notes.md");

const PASSWORD = "e2e-password-123";
const NEW_PASSWORD = "e2e-rotated-456";
const RUN_TAG = Date.now().toString(36);
const SQUARE_TOPIC = `E2E 广场计划 ${RUN_TAG}`;

async function register(page: import("@playwright/test").Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page).toHaveURL(/\/plans/);
}

test.describe("the square fork journey (publish → adopt)", () => {
  // Serial: the second test forks what the first published.
  test.describe.configure({ mode: "serial" });

  test("a plan can be published to the square and its owner logged out (FR-38)", async ({ page }) => {
    const email = `e2e-sq-a-${RUN_TAG}@synapse.test`;
    await register(page, email);

    // Create the plan through the creation chat (stubbed proposal).
    await page.getByPlaceholder(/COMP5241/).fill(SQUARE_TOPIC);
    await page.getByRole("button", { name: "生成" }).click();
    await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "确认创建计划" }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // The confirm-gated visibility flip (structure-only disclosure).
    await page.getByTestId("visibility-action").click();
    await expect(page.getByTestId("visibility-popover")).toBeVisible();
    await page.getByTestId("visibility-confirm").click();
    await expect(page.getByTestId("visibility-chip")).toHaveText(/公开/);

    // The owner leaves; the plan stays in the square.
    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("another learner adopts it from the square — adoption is a fork with attribution", async ({ page }) => {
    const email = `e2e-sq-b-${RUN_TAG}@synapse.test`;
    await register(page, email);

    await page.getByRole("button", { name: "广场" }).click();
    await expect(page.getByTestId("square-section")).toBeVisible();

    const card = page.getByTestId("square-plan-card").filter({ hasText: SQUARE_TOPIC });
    await expect(card).toBeVisible();
    await card.getByTestId("square-card-adopt").click();

    // The fork lands on the adopter's own plan home, attributed to the source.
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("fork-attribution")).toHaveText(new RegExp(SQUARE_TOPIC));
    await expect(page.getByText("概念地图")).toBeVisible();
  });
});

test.describe("deterministic destinations", () => {
  test("a study task promotes into an independent plan (FR-37, epic-14 T2)", async ({ page }) => {
    const email = `e2e-task-${RUN_TAG}@synapse.test`;
    await register(page, email);

    // Creation lands in the reader (「直接开始学习」) — the task home is
    // reached the way a user reaches it: back to Plans Home, the recent task
    // card, the task's own page.
    await page.goto("/task/new");
    await page.locator('input[type="file"]').setInputFiles(MATERIAL_PATH);
    await page.getByRole("button", { name: "开始学习" }).click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "The study loop" })).toBeVisible();

    await page.getByRole("button", { name: "所有计划" }).click();
    await expect(page).toHaveURL(/\/plans/);
    await page.locator('a[href^="/task/"]').first().click();
    await expect(page).toHaveURL(/\/task\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "知识节点" })).toBeVisible();

    await page.getByTestId("task-promote-button").click();
    await page.getByRole("button", { name: "确认升级" }).click();

    // The promotion navigates to the new plan home (evidence continuity is
    // server-proven — node ids survive, epic-14 T2).
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByText("study-notes").first()).toBeVisible();
  });

  test("settings: a password change survives logout and re-login", async ({ page }) => {
    const email = `e2e-pw-${RUN_TAG}@synapse.test`;
    await register(page, email);

    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await page.getByLabel("当前密码").fill(PASSWORD);
    await page.getByLabel("新密码", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("确认新密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "更新密码" }).click();
    await expect(page.getByText("密码已更新")).toBeVisible();

    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login/);

    // The OLD password must now fail; the NEW one must land inside.
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByText("邮箱或密码不正确，请重试。")).toBeVisible();

    await page.getByLabel("密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/plans/);
  });

  test("settings: the data export downloads a JSON document", async ({ page }) => {
    const email = `e2e-export-${RUN_TAG}@synapse.test`;
    await register(page, email);

    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/settings/);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    await expect(page.getByText("数据已导出。")).toBeVisible();
  });

  test("the retained destinations render for a fresh account (the ten-page promise)", async ({ page }) => {
    const email = `e2e-dest-${RUN_TAG}@synapse.test`;
    await register(page, email);

    // Each hub answers with its own real surface — no login bounce, no crash.
    await page.goto("/planner");
    await expect(page.getByText("今天，先做这几件。")).toBeVisible();
    await page.goto("/quiz");
    await expect(page.getByText("测验历史")).toBeVisible();
    await page.goto("/analytics");
    await expect(page.getByText("只统计证据，不统计停留。")).toBeVisible();
    for (const route of ["/dashboard", "/achievements", "/flashcards"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      // The shell rendered (any sidebar link proves the layout mounted).
      // exact:true — getByRole names match by SUBSTRING by default, and on
      // /dashboard the page's own KPI card (aria-label "错题本: 0") collides
      // with the sidebar link once its data lands (first CI run's only red:
      // the twin run passed because the KPI loaded after the assertion).
      await expect(page.getByRole("link", { name: "错题本", exact: true })).toBeVisible();
    }
  });
});
