import { expect, test, type Page } from "@playwright/test";

/**
 * The interactive roadmap's e2e coverage (epic-16 T4, ticket 04) over the live
 * local stack: creation chat → confirm → the 16-node graph renders with real
 * arrows (and the stub's one deliberately invalid backward edge is ABSENT —
 * the server dropped it, Plans::PlanCreation#drop_edge); a node click opens
 * the sheet (description + optional badge); `?node=` deep-links (select + pan
 * + sheet); the progress bar counts off server states; the graph IS the
 * default plan view with the List toggle one click away.
 *
 * The stub provider (e2e/stub-provider.mjs) is the deterministic fixture — its
 * proposal shape (stage/column/edge counts below) is the contract this spec
 * pins. Harness lessons honored: explicit timeouts everywhere (the 1s default
 * breaks under load), node titles are SVG <text> inside g[data-node-id], and
 * clicks on far nodes come after fit-view (the canvas never scrolls).
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
const EDGE_COUNT = 12; // the stub emits 13 pairs; the backward one drops server-side
const BACKWARD_EDGE = { from: "模拟面试复盘", to: "复杂度分析" };

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

test.describe.configure({ mode: "serial" });

test.describe("the roadmap graph surface", () => {
  test("confirming the stub proposal renders the 16-node graph with real arrows; the backward edge is dropped", async ({
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

    // The graph IS the default view — the canvas renders with no toggle click.
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    // The plan progress bar counts off SERVER states (AD-14): a fresh plan is 0/16.
    const progress = page.getByTestId("roadmap-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByText(/0\/16/)).toBeVisible();

    // The four stage columns render their labels + per-stage progress.
    for (const stage of STAGES) {
      await expect(page.getByTestId("roadmap-stage-label").filter({ hasText: stage })).toBeVisible();
    }

    // All 16 nodes render (SVG <text> titles inside the g[role=button] boxes).
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);
    await expect(nodeBox(page, FIRST_NODE)).toBeVisible();

    // Real arrows: exactly the 12 persisted forward edges, each carrying the
    // shared arrowhead marker.
    const edges = page.getByTestId("roadmap-edge");
    await expect(edges).toHaveCount(EDGE_COUNT);
    await expect(edges.first()).toHaveAttribute("marker-end", "url(#roadmap-arrow)");

    // The one deliberately invalid stub edge (backward: 面试实战 → 基础奠基)
    // must be absent — resolvable titles, dropped by stage-forward validity.
    const fromId = await nodeBox(page, BACKWARD_EDGE.from).getAttribute("data-node-id");
    const toId = await nodeBox(page, BACKWARD_EDGE.to).getAttribute("data-node-id");
    expect(fromId).toBeTruthy();
    expect(toId).toBeTruthy();
    await expect(
      page.locator(`[data-testid="roadmap-edge"][data-edge-from="${fromId}"][data-edge-to="${toId}"]`),
    ).toHaveCount(0);

    // The optional node is dashed + carries the visible 「可选」 marker line
    // (AD-9 not-color-only).
    await expect(nodeBox(page, OPTIONAL_NODE).getByTestId("roadmap-node-optional")).toBeVisible();
    await expect(page.getByTestId("roadmap-node-optional")).toHaveCount(1);
  });

  test("a node click opens the sheet with its description; the optional node shows the badge", async ({
    page,
  }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    const sheet = page.getByTestId("roadmap-detail");

    // Stage-1's first node sits on-canvas at the identity view — a plain click.
    await nodeBox(page, FIRST_NODE).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: FIRST_NODE })).toBeVisible();
    await expect(sheet.getByTestId("roadmap-node-desc")).toHaveText(FIRST_DESC);
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });

    // The optional node may sit off the identity view — fit-view first (the
    // canvas never scrolls), then click: the sheet gains the optional badge.
    await page.getByTestId("roadmap-fit").click();
    await nodeBox(page, OPTIONAL_NODE).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: OPTIONAL_NODE })).toBeVisible();
    await expect(sheet.getByTestId("roadmap-node-optional-badge")).toHaveText(/可选/);
    await expect(sheet.getByTestId("roadmap-node-desc")).toHaveText(OPTIONAL_DESC);
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
  });

  test("a ?node= deep-link selects, pans into view, focuses, and opens the sheet", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });

    // A stage-4 node — off-canvas at the identity view, so the deep-link must
    // PAN it into view (the keyboard's ensureBoxVisible path), not just select.
    const target = await nodeBox(page, BACKWARD_EDGE.from);
    const nodeId = await target.getAttribute("data-node-id");
    const planUrl = page.url();

    await page.goto(`${planUrl}?node=${nodeId}`);
    await expect(page).toHaveURL(/\?node=/, { timeout: 15_000 });

    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByRole("heading", { name: BACKWARD_EDGE.from })).toBeVisible();

    // Selected AND roving-focused state on the box. (DOM focus itself moves
    // INTO the opened sheet — Radix's modal focus trap, the correct a11y
    // posture for a dialog — so document.activeElement is the sheet, not
    // the node behind it.)
    await expect(target).toHaveAttribute("data-focused", "true", { timeout: 15_000 });

    // Pan proof: the off-view stage-4 node is fully inside the measured
    // canvas after the deep-link — the keyboard's ensureBoxVisible path ran.
    const visible = await page.evaluate((id) => {
      const canvas = document.querySelector('[data-testid="roadmap-canvas"]');
      const el = document.querySelector(`[data-node-id="${id}"]`);
      if (!canvas || !el) return false;
      const c = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    }, nodeId);
    expect(visible).toBe(true);
  });

  test("Graph stays the default view and the List toggle keeps working", async ({ page }) => {
    await registerOrLogin(page);
    await page.getByText(TOPIC).first().click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);

    // Default: the canvas — not the list — meets the user, no clicks needed.
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);

    // One click to the stage-grouped list; the graph unmounts.
    await page.getByRole("button", { name: "列表" }).click();
    await expect(page.getByTestId("roadmap-canvas")).toHaveCount(0);
    await expect(page.getByText(FIRST_NODE).first()).toBeVisible();

    // And back to the roadmap.
    await page.getByRole("button", { name: "路线图" }).click();
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(NODE_COUNT);
  });
});
