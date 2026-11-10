import { expect, test, type Page } from "@playwright/test";

/**
 * The spine roadmap's e2e coverage (epic-28 T5) over the live local stack:
 * creation chat → confirm → the 16-node spine renders (4 hub cards on the
 * solid spine, 16 leaves on the dotted fans, the 12 persisted prerequisites
 * as dotted brackets/dips, and the stub's one deliberately invalid backward
 * edge ABSENT — the server dropped it); a node click opens the sheet;
 * hovering opens the chip strip and a mark persists across reload (FR-47)
 * while the progress bar stays pure mastery (AD-14); `?node=` deep-links
 * (scroll into view + sheet); the spine IS the default plan view with List
 * one click away. No zoom/pan/pinch affordances exist anywhere — page scroll
 * is the only navigation (the widget era is over).
 *
 * The stub provider (e2e/stub-provider.mjs) is the deterministic fixture —
 * its proposal shape (stage/node/edge counts below) is the contract this
 * spec pins. Harness lessons honored: explicit timeouts everywhere, node
 * titles live in the g's aria-label (SVG <text> is not text-matchable), and
 * the browser auto-scrolls the tall page for far nodes.
 */

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-roadmap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 路线图验证";
const FIRST_NODE = "复杂度分析";
const OPTIONAL_NODE = "二分查找";
const OPTIONAL_DESC = "边界写法与常见变形";
const FIRST_DESC = "大 O、均摊分析与常见代价模型";
const STAGES = ["基础奠基", "核心结构", "进阶专题", "面试实战"];
const NODE_COUNT = 16;
const PREREQ_COUNT = 12; // the stub emits 13 pairs; the backward one drops server-side
const BACKWARD_EDGE = { from: "模拟面试复盘", to: "复杂度分析" };
const LAST_NODE = BACKWARD_EDGE.from;

async function registerOrLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/plans/);
}

/** One node box by title — the title lives in the g's aria-label (SVG <text>
 * content is not matchable by text filters, the harness lesson), and titles
 * are unique across the proposal, so the substring match is exact in practice. */
function nodeBox(page: Page, title: string) {
  return page.locator(`[data-testid="roadmap-node"][aria-label*="${title}"]`);
}

/** The chip strip's 150ms hover-intent needs a real beat. */
async function hoverNode(page: Page, title: string) {
  await nodeBox(page, title).hover({ position: { x: 60, y: 25 } });
  await page.waitForTimeout(250);
}

test.describe.configure({ mode: "serial" });

test.describe("the spine roadmap surface", () => {
  test("confirming the stub proposal renders the 16-node spine; the backward edge is dropped; no arrowheads", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/plans/);

    await page.getByPlaceholder(/COMP5241/).fill(TOPIC);
    await page.getByRole("button", { name: "生成" }).click();
    await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "确认创建计划" }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // The spine IS the default view — the canvas renders with no toggle click.
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    // The plan progress bar counts off SERVER states (AD-14): a fresh plan is 0/16.
    const progress = page.getByTestId("roadmap-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByText(/0\/16/)).toBeVisible();

    // The four stage hubs render their labels + per-stage mastered/total.
    for (const stage of STAGES) {
      await expect(page.getByTestId("roadmap-stage-label").filter({ hasText: stage })).toBeVisible();
    }

    // All 16 leaves render (aria-labels carry the titles).
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);
    await expect(nodeBox(page, FIRST_NODE)).toBeVisible();

    // The edge classes: 12 prereq brackets/dips + 16 fan curves + 3 spine
    // segments — and NO arrowhead marker anywhere (direction is geometric).
    await expect(page.getByTestId("roadmap-edge")).toHaveCount(PREREQ_COUNT + NODE_COUNT + (STAGES.length - 1));
    await expect(page.locator("[data-edge-kind='prereq']")).toHaveCount(PREREQ_COUNT);
    await expect(page.locator("[data-edge-kind='fan']")).toHaveCount(NODE_COUNT);
    await expect(page.locator("[data-edge-kind='spine']")).toHaveCount(STAGES.length - 1);
    await expect(page.locator("#roadmap-arrow")).toHaveCount(0);

    // The one deliberately invalid stub edge (backward: 面试实战 → 基础奠基)
    // must be absent — resolvable titles, dropped by stage-forward validity.
    const fromId = await nodeBox(page, BACKWARD_EDGE.from).getAttribute("data-node-id");
    const toId = await nodeBox(page, BACKWARD_EDGE.to).getAttribute("data-node-id");
    expect(fromId).toBeTruthy();
    expect(toId).toBeTruthy();
    await expect(
      page.locator(`[data-testid="roadmap-edge"][data-edge-from="${fromId}"][data-edge-to="${toId}"]`),
    ).toHaveCount(0);

    // The optional node is dashed + carries the visible 「可选」 marker (AD-9).
    await expect(nodeBox(page, OPTIONAL_NODE).getByTestId("roadmap-node-optional")).toBeVisible();
    await expect(page.getByTestId("roadmap-node-optional")).toHaveCount(1);

    // The copied skin rides tokens — spot-check the hub face on a hub rect.
    const hubRect = page.getByTestId("roadmap-stage-group").first().locator("rect").first();
    await expect(hubRect).toHaveAttribute("style", /var\(--roadmap-hub-face\)/);
  });

  test("a node click opens the sheet with its description; the optional node shows the badge", async ({
    page,
  }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    const sheet = page.getByTestId("roadmap-detail");

    // The page auto-scrolls to any node — the spine is full-page now.
    await nodeBox(page, FIRST_NODE).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: FIRST_NODE })).toBeVisible();
    await expect(sheet.getByTestId("roadmap-node-desc")).toHaveText(FIRST_DESC);
    // The sheet carries the mark toggles + the evidence bar (epic-28 T4).
    await expect(sheet.getByTestId("study-mark-toggle")).toBeVisible();
    await expect(sheet.getByTestId("evidence-marks")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });

    await nodeBox(page, OPTIONAL_NODE).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: OPTIONAL_NODE })).toBeVisible();
    await expect(sheet.getByTestId("roadmap-node-optional-badge")).toHaveText(/可选/);
    await expect(sheet.getByTestId("roadmap-node-desc")).toHaveText(OPTIONAL_DESC);
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
  });

  test("hover chips mark a node 已完成; the chip + the count survive reload; mastery stays 0", async ({
    page,
  }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    // Hover → the chip strip; row 1 marks the node 已完成.
    await hoverNode(page, FIRST_NODE);
    const strip = page.getByTestId("roadmap-chips");
    await expect(strip).toBeVisible();
    await strip.getByTestId("study-mark-finished").click();

    // The canvas corner chip flips immediately (the optimistic overlay).
    await expect(nodeBox(page, FIRST_NODE).getByTestId("roadmap-node-mark")).toHaveAttribute(
      "data-mark",
      "finished",
    );

    // The mark line counts it; the mastery bar STAYS 0 (orthogonality, AD-14).
    await expect(page.getByTestId("roadmap-marks-line")).toContainText(/已标记完成 1/);
    await expect(page.getByTestId("roadmap-progress")).toHaveAttribute("aria-valuenow", "0");

    // Server truth: reload — the chip and the count persist.
    await page.reload();
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(nodeBox(page, FIRST_NODE).getByTestId("roadmap-node-mark")).toHaveAttribute(
      "data-mark",
      "finished",
    );
    await expect(page.getByTestId("roadmap-marks-line")).toContainText(/已标记完成 1/);
    await expect(page.getByTestId("roadmap-progress")).toHaveAttribute("aria-valuenow", "0");
  });

  test("a ?node= deep-link scrolls the node into view, focuses, and opens the sheet", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    const target = await nodeBox(page, LAST_NODE);
    const nodeId = await target.getAttribute("data-node-id");
    const planUrl = page.url();

    await page.goto(`${planUrl}?node=${nodeId}`);
    await expect(page).toHaveURL(/\?node=/, { timeout: 15_000 });

    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByRole("heading", { name: LAST_NODE })).toBeVisible();
    await expect(target).toHaveAttribute("data-focused", "true", { timeout: 15_000 });

    // Scroll proof: the deep-linked node is inside the BROWSER viewport after
    // the native scrollIntoView (the tall page navigates by scrolling).
    const visible = await page.evaluate((id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
    }, nodeId);
    expect(visible).toBe(true);
  });

  test("no zoom/pan/pinch affordances exist anywhere", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    for (const testid of ["roadmap-zoom-in", "roadmap-zoom-out", "roadmap-fit", "roadmap-zoom-reset", "roadmap-viewport"]) {
      await expect(page.getByTestId(testid)).toHaveCount(0);
    }
    // No horizontal overflow at any width — the spine always fits.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the spine stays the default view and the List toggle keeps working", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // Default: the spine — not the list — meets the user, no clicks needed.
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);

    // One click to the stage-grouped list; the spine unmounts.
    await page.getByRole("button", { name: "列表" }).click();
    await expect(page.getByTestId("roadmap-canvas")).toHaveCount(0);
    await expect(page.getByText(FIRST_NODE).first()).toBeVisible();

    // And back to the roadmap.
    await page.getByRole("button", { name: "路线图" }).click();
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);
  });
});
