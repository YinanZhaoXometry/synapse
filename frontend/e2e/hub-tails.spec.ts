import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The hub tails' server-live flows (epic-18 T5): the Materials hub reads the
 * server (T3's re-point — the demo rows are gone) and the Mistakes hub's
 * resolve lifecycle persists across reloads and drives the state filter
 * (T1's wire + T4's toggle).
 *
 * One serial learner journey over the shared dev database (the study-loop
 * pattern): register fresh → create a plan through the creation chat (the
 * stub proposal) → attach the fixture material → assert the hub rows → run
 * the stub choice quiz to one deliberate wrong answer → work the mistake
 * lifecycle. Tests re-login through the UI — browser contexts do not share
 * localStorage, the account persists server-side.
 *
 * The generation-backed Today suggestion (T2) is AI-gated and stays
 * e2e-uncovered by harness convention: this file adds NO stub-provider
 * prompt shape and asserts nothing about the AI suggestion — its states are
 * carried by the vitest suite.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MATERIAL_PATH = path.join(here, "fixtures", "study-notes.md");

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-tails-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 枢纽收尾验证";
// One hard-coded demo row's title fragment (the retired demo-data fixture) —
// its presence on /materials would mean the server re-point regressed.
const DEMO_ROW_TITLE = "COMP5241 Lecture 4";

async function registerOrLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/plans/);
}

/** The state filter combobox (its label text wraps the select). */
function stateFilter(page: import("@playwright/test").Page) {
  return page.locator("label").filter({ hasText: "按状态筛选" }).locator("select");
}

test.describe.configure({ mode: "serial" });

test.describe("the hub tails (epic-18)", () => {
  test("a plan-attached material is the materials hub's row and opens in the reader (T3)", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/plans/);

    // The creation chat turns the topic into a confirmed plan (stub proposal).
    await page.getByPlaceholder(/COMP5241/).fill(TOPIC);
    await page.getByRole("button", { name: "生成" }).click();
    await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "确认创建计划" }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // The plan page's queries must settle BEFORE the upload fires (the
    // study-loop S4 lesson — an upload racing the settling queries hangs).
    await expect(page.getByRole("img", { name: "掌握度 0%" })).toBeVisible();
    await expect(page.getByText("还没有材料")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(MATERIAL_PATH);
    await expect(page.getByText(/已解析 · \d+ 节/)).toBeVisible();

    // The hub renders the SERVER row — wire truth only.
    await page.getByRole("link", { name: "学习资料" }).click();
    await expect(page).toHaveURL(/\/materials/);

    const openLink = page.getByRole("link", { name: "打开「study-notes」" });
    await expect(openLink).toBeVisible();
    // The row's wire meta: kind label + byte size (the fixture is sub-KB).
    const pageBody = page.locator("body");
    await expect(pageBody).toContainText("Markdown");
    await expect(pageBody).toContainText(/study-notes[\s\S]*\d+ B/);
    // The real scope chip: the owning plan's topic (never a raw id).
    await expect(page.getByTestId("scope-chip")).toHaveText(TOPIC);
    // The retired demo rows are gone — the page renders only server rows.
    await expect(page.getByText(DEMO_ROW_TITLE)).toHaveCount(0);

    // The kind filter is real: markdown keeps the row, pdf empties honestly.
    await page.getByRole("button", { name: "Markdown" }).click();
    await expect(openLink).toBeVisible();
    await page.getByRole("button", { name: "PDF" }).click();
    await expect(page.getByText("没有匹配的材料。")).toBeVisible();
    await page.getByRole("button", { name: "全部" }).click();
    await expect(openLink).toBeVisible();

    // Open walks the reader deep link (the session blob renders the sections).
    await openLink.click();
    await expect(page).toHaveURL(/\/read\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "The study loop" })).toBeVisible();
  });

  test("the wrong answer's resolve toggle survives reload and drives the state filter (T1/T4)", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByRole("img", { name: "掌握度 0%" })).toBeVisible();

    // The stub choice quiz, three questions — the middle answered wrong on
    // purpose so a mistake exists (the study-loop S6 picks: 0/1/2 correct).
    await page.getByRole("button", { name: "出题" }).first().click();
    const launcher = page.getByTestId("quiz-launcher");
    await expect(launcher).toBeVisible();
    await page.getByTestId("quiz-mode-choice").click();
    await page.getByTestId("quiz-scope-plan").click();
    await page.getByTestId("quiz-launcher-start").click();

    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}\/quiz/, { timeout: 30_000 });
    await expect(page.getByText(/第 1 \/ 3 题/)).toBeVisible();

    const picks = [0, 0, 2];
    for (let i = 0; i < 3; i += 1) {
      await expect(page.getByText(new RegExp(`第 ${i + 1} / 3 题`))).toBeVisible();
      await page.getByTestId(`quiz-option-${picks[i]}`).click();
      await page.getByRole("button", { name: "确认作答" }).click();
      await page.getByRole("button", { name: /下一题|查看结果/ }).click();
    }
    await expect(page.getByText("证据已经更新。")).toBeVisible();

    // The hub carries the entry (the deliberate wrong answer).
    await page.getByRole("link", { name: "错题本" }).click();
    await expect(page).toHaveURL(/\/mistakes/);
    // Router 7 commits route swaps inside a startTransition: the URL flips
    // synchronously while the previous screen (the quiz results, which renders
    // the SAME question text) can stay mounted until the lazy route chunk
    // resolves. The hub's own heading is the committed-screen signal — the
    // strict card locator below must never resolve against the old tree.
    await expect(page.getByRole("heading", { name: "错因比答案更有用。" })).toBeVisible();
    const card = page.locator("article").filter({ hasText: "Stub question 2: which option is the study answer?" });
    await expect(card).toBeVisible();
    await expect(card.getByText("你的答案")).toBeVisible();

    // Resolve it: the toggle flips through the mutation + refetch sweep
    // (read-back-is-truth), the card goes quiet with its 已复盘 chip.
    await card.getByRole("button", { name: "标记这条错题已复盘" }).click();
    await expect(card.getByRole("button", { name: "重新打开这条错题" })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText("已复盘")).toBeVisible();

    // Server truth: the resolved state survives a full reload.
    await page.reload();
    const reloaded = page.locator("article").filter({ hasText: "Stub question 2: which option is the study answer?" });
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByRole("button", { name: "重新打开这条错题" })).toHaveAttribute("aria-pressed", "true");

    // The state filter works: reviewed shows the card, open is honestly empty.
    const stateSelect = stateFilter(page);
    await stateSelect.selectOption({ label: "已复盘" });
    await expect(reloaded).toBeVisible();
    await stateSelect.selectOption({ label: "待复盘" });
    await expect(page.getByText("这个状态下暂无错题。")).toBeVisible();

    // The toggle works both ways: reopen, and the card is open again.
    await stateSelect.selectOption({ label: "全部状态" });
    await reloaded.getByRole("button", { name: "重新打开这条错题" }).click();
    await expect(reloaded.getByRole("button", { name: "标记这条错题已复盘" })).toHaveAttribute("aria-pressed", "false");
    await stateSelect.selectOption({ label: "待复盘" });
    await expect(reloaded).toBeVisible();
  });
});
