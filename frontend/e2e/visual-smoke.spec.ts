import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The live visual smoke (epic-16 T4, ticket 04) — OPT-IN, not part of the
 * default suite: run with
 *
 *   E2E_VISUAL_SMOKE=1 npx playwright test e2e/visual-smoke.spec.ts   (from frontend/)
 *
 * while a backend stack and the Vite dev server are up (the plan itself is
 * seeded through the createPlan mutation — no stub provider needed, so this
 * runs against the stub-wired e2e stack OR the plain dev stack). It drives
 * the REAL 16-node graph on the live stack through the visual matrix the
 * ticket names — light + dark, one non-default palette (twilight),
 * reduced-motion, fit-view + zoom + keyboard roving focus — and saves full
 * screenshots OUTSIDE the repository (the OS temp dir) for human review.
 *
 * Honest caveats (recorded in the close-out): the browser is Playwright's
 * bundled Chromium (the harness's own — the ticket allows this); the theme/
 * palette/motion matrix is driven through ThemeContext's localStorage contract
 * via addInitScript, not the Settings UI clicks; the epic-08/10 in-App-Browser
 * guest-profile rAF stall does not apply to desktop Chromium (no stall was
 * observed — rAF-driven transitions rendered normally).
 */

const SMOKE_DIR = path.join(os.tmpdir(), "synapse-t04-visual-smoke");
const RUN = process.env.E2E_VISUAL_SMOKE === "1";
/** The api origin the smoke seeds against — must be the SAME api the app
 * talks to (default the compose-published port; override with E2E_API_URL
 * when the stack runs on remapped ports — accepts the origin or the full
 * /graphql endpoint, mirroring VITE_API_URL). */
const API = (process.env.E2E_API_URL ?? "http://localhost:3000").replace(/\/graphql\/?$/, "").replace(/\/$/, "");

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 视觉冒烟验证";
const FIRST_NODE = "复杂度分析";
/** Fixed per run: the serial tests re-seed the SAME plan (AD-12 idempotent replay). */
const PLAN_UUID = crypto.randomUUID();

/**
 * The 16-node roadmap the smoke visualizes — the SAME stage/title/description/
 * optional payload the stub proposal carries, seeded straight through the
 * createPlan mutation (the exact wire shape the creation chat's confirm sends:
 * client-minted node uuids + title-resolved id-paired edges). This keeps the
 * VISUAL matrix independent of the AI provider: it runs against ANY stack
 * (the stub-wired e2e stack or the plain dev stack), while the chat→confirm
 * journey itself stays covered by roadmap-graph.spec.ts.
 */
const PLAN_NODES: Array<{ stage: string; title: string; description: string; optional: boolean }> = [
  { stage: "基础奠基", title: "复杂度分析", description: "大 O、均摊分析与常见代价模型", optional: false },
  { stage: "基础奠基", title: "数组与链表", description: "线性结构的取舍与操作代价", optional: false },
  { stage: "基础奠基", title: "栈与队列", description: "受限访问顺序与典型套路", optional: false },
  { stage: "基础奠基", title: "哈希表原理", description: "散列、冲突处理与负载因子", optional: false },
  { stage: "核心结构", title: "二叉树遍历", description: "前中后序与层序的递归迭代写法", optional: false },
  { stage: "核心结构", title: "排序算法", description: "比较排序家族与稳定性", optional: false },
  { stage: "核心结构", title: "二分查找", description: "边界写法与常见变形", optional: true },
  { stage: "核心结构", title: "堆与优先队列", description: "堆序性质与 Top-K 套路", optional: false },
  { stage: "核心结构", title: "图的表示", description: "邻接表、矩阵与遍历框架", optional: false },
  { stage: "进阶专题", title: "动态规划入门", description: "状态、转移与初始化三板斧", optional: false },
  { stage: "进阶专题", title: "回溯与剪枝", description: "排列组合子集的搜索框架", optional: false },
  { stage: "进阶专题", title: "字符串匹配", description: "双指针与滑动窗口应用", optional: false },
  { stage: "进阶专题", title: "手写代码训练", description: "白板无提示的限时编码练习", optional: false },
  { stage: "进阶专题", title: "并查集", description: "连通性判定与路径压缩", optional: false },
  { stage: "面试实战", title: "高频题精练", description: "按题型分类的真题串讲", optional: false },
  { stage: "面试实战", title: "模拟面试复盘", description: "限时模拟与错因归纳", optional: false },
];

const PLAN_EDGES: Array<[string, string]> = [
  ["复杂度分析", "二叉树遍历"],
  ["数组与链表", "排序算法"],
  ["数组与链表", "二分查找"],
  ["栈与队列", "堆与优先队列"],
  ["哈希表原理", "图的表示"],
  ["排序算法", "动态规划入门"],
  ["二叉树遍历", "回溯与剪枝"],
  ["二分查找", "字符串匹配"],
  ["堆与优先队列", "手写代码训练"],
  ["图的表示", "并查集"],
  ["动态规划入门", "高频题精练"],
  ["手写代码训练", "模拟面试复盘"],
];

/** Sunset's runtime --grad-a triplet, captured in the dark test and compared
 * against in the twilight test (the palette must actually re-tint). */
let sunsetGradA = "";

test.skip(!RUN, "live visual smoke is opt-in: E2E_VISUAL_SMOKE=1");

test.describe.configure({ mode: "serial" });

function shoot(page: Page, name: string) {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SMOKE_DIR, name), fullPage: true });
}

/** Pins ThemeContext prefs before the app boots (the storage contract, AGENTS.md —
 * one synapse-* localStorage key per setting, read at provider mount). */
function pinPrefs(page: Page, prefs: { mode?: string; theme?: string; motion?: string }) {
  const map: Record<string, string> = {};
  if (prefs.mode) map["synapse-mode"] = prefs.mode;
  if (prefs.theme) map["synapse-theme"] = prefs.theme;
  if (prefs.motion) map["synapse-motion"] = prefs.motion;
  return page.addInitScript((pairs) => {
    for (const [key, value] of pairs) localStorage.setItem(key, value);
  }, Object.entries(map));
}

async function registerOrLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(EMAIL);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/plans/);
  await page.getByText(TOPIC).first().click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
}

/** Creates (or replays) the smoke's 16-node plan over createPlan — idempotent
 * on clientUuid (AD-12), so the serial tests all ride one plan. Returns the
 * plan id; the caller navigates to it. */
async function seedPlan(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("synapse-token"));
  const idByTitle = new Map<string, string>();
  const nodes = PLAN_NODES.map((node) => {
    const id = crypto.randomUUID();
    idByTitle.set(node.title, id);
    return { id, title: node.title, stage: node.stage, description: node.description, optional: node.optional };
  });
  const edges = PLAN_EDGES.map(([from, to]) => ({
    fromNodeId: idByTitle.get(from) as string,
    toNodeId: idByTitle.get(to) as string,
  }));
  const response = await page.request.post(`${API}/graphql`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      query: `mutation CreatePlan($input: CreatePlanInput!) { createPlan(input: $input) { plan { id topic } } }`,
      variables: { input: { clientUuid: PLAN_UUID, topic: TOPIC, visibility: "private", nodes, edges } },
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  return body.data.createPlan.plan.id as string;
}

/** One node box by title — the title lives in the g's aria-label (SVG <text>
 * content is not matchable by text filters, the harness lesson). */
function nodeBox(page: Page, title: string) {
  return page.locator(`[data-testid="roadmap-node"][aria-label*="${title}"]`);
}

test.describe("the 16-node graph visual matrix", () => {
  test("seeded 16-node plan → light/sunset default → fit-view → zoom → node sheet", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/plans/);

    const planId = await seedPlan(page);
    await page.goto(`/plan/${planId}`);
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(16);

    // Light + sunset (the defaults): the whole plan home with the graph.
    await shoot(page, "01-graph-light-sunset-default.png");

    // Fit-view really rescales the viewport transform: 16 nodes overflow the
    // ~440px canvas at zoom 1, so the fit zoom settles BELOW 1 (the 160ms
    // ease-out transition needs a settle poll, not an instant read).
    const scaleOf = (style: string | null | undefined) =>
      Number((style?.match(/scale\(([\d.]+)\)/) ?? [])[1]);
    const viewport = page.getByTestId("roadmap-viewport");
    await page.getByTestId("roadmap-fit").click();
    await expect
      .poll(async () => scaleOf(await viewport.getAttribute("style")), { timeout: 5_000 })
      .toBeLessThan(1);
    const fitted = scaleOf(await viewport.getAttribute("style"));

    // Zoom in two pinned steps (+0.25 each, ZOOM_STEP): the scale grows by
    // exactly 0.5 from the fitted value (clamped at 2).
    await page.getByTestId("roadmap-zoom-in").click();
    await page.getByTestId("roadmap-zoom-in").click();
    await expect
      .poll(async () => scaleOf(await viewport.getAttribute("style")), { timeout: 5_000 })
      .toBeCloseTo(fitted + 0.5, 1);
    await shoot(page, "02-graph-light-sunset-fit-zoom.png");

    // The node detail sheet over the graph (description line visible). The
    // Radix sheet slides in — let the entrance animation settle before the
    // screenshot, or the panel is captured mid-transform off-frame.
    const node = nodeBox(page, FIRST_NODE);
    await expect(node).toHaveCount(1);
    await node.click();
    await expect(page.getByTestId("roadmap-detail")).toBeVisible();
    await expect(page.getByTestId("roadmap-node-desc")).toBeVisible();
    await page.waitForTimeout(600);
    await shoot(page, "03-graph-light-sunset-sheet.png");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("roadmap-detail")).not.toBeVisible({ timeout: 5_000 });
  });

  test("keyboard roving focus moves with arrows and pans off-view nodes into the canvas", async ({
    page,
  }) => {
    await registerOrLogin(page);

    // Deterministic focus seed: the first node carries the roving tabindex=0
    // (component default), and tabindex=-1 boxes stay programmatically
    // focusable — the same el.focus() path the component's own keyboard
    // handler uses. (Click+Esc seeding is racy: Radix's modal focus restore
    // doesn't reliably land back on an SVG node in real Chromium.)
    const first = nodeBox(page, FIRST_NODE);
    const firstId = await first.getAttribute("data-node-id");
    await page.evaluate((id) => {
      (document.querySelector(`[data-node-id="${id}"]`) as SVGElement | null)?.focus();
    }, firstId);

    const activeId = () => page.evaluate(() => document.activeElement?.getAttribute("data-node-id"));

    const startId = await activeId();
    expect(startId).toBe(firstId);

    // Right: across columns (column 0 → column 1). Down: within the new column.
    await page.keyboard.press("ArrowRight");
    const rightId = await activeId();
    expect(rightId).toBeTruthy();
    expect(rightId).not.toBe(startId);
    await expect(page.getByTestId("roadmap-node").filter({ hasText: FIRST_NODE })).not.toHaveAttribute(
      "data-focused",
      "true",
      { timeout: 5_000 },
    );
    await page.keyboard.press("ArrowDown");
    const downId = await activeId();
    expect(downId).toBeTruthy();
    expect(downId).not.toBe(rightId);

    // Capture the roving-focused node's name BEFORE Enter — once the sheet
    // opens, Radix's modal focus trap moves DOM focus into the dialog.
    const focusedLabel = await page.evaluate(() =>
      (document.activeElement as SVGElement | null)?.getAttribute("aria-label") ?? "",
    );
    const focusedTitle = focusedLabel.replace(/^节点 /, "").split("，")[0];
    expect(focusedTitle.length).toBeGreaterThan(0);

    // Enter opens the sheet for the roving-focused node (the keyboard contract).
    await page.keyboard.press("Enter");
    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: focusedTitle })).toBeVisible();
    await page.keyboard.press("Escape");

    // Far right column, bottom row — off the identity view; arrowing there must
    // PAN it into the canvas (ensureBoxVisible), leaving real DOM focus on it.
    const far = nodeBox(page, "模拟面试复盘");
    const farId = await far.getAttribute("data-node-id");
    await page.evaluate((id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`) as SVGElement | null;
      el?.focus();
    }, farId);
    await page.keyboard.press("ArrowLeft");
    const leftId = await activeId();
    expect(leftId).toBeTruthy();
    expect(leftId).not.toBe(farId);
    // The newly focused node is fully inside the measured canvas.
    const visible = await page.evaluate((id) => {
      const canvas = document.querySelector('[data-testid="roadmap-canvas"]');
      const el = document.querySelector(`[data-node-id="${id}"]`);
      if (!canvas || !el) return false;
      const c = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    }, leftId);
    expect(visible).toBe(true);
  });

  test("dark mode (sunset) keeps the graph legible", async ({ page }) => {
    pinPrefs(page, { mode: "dark" });
    await registerOrLogin(page);
    await expect(page.locator("html")).toHaveClass(/dark/);
    sunsetGradA = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--grad-a").trim(),
    );
    expect(sunsetGradA).toBeTruthy();
    await shoot(page, "04-graph-dark-sunset.png");
  });

  test("the twilight palette re-tints the graph in dark mode", async ({ page }) => {
    pinPrefs(page, { mode: "dark", theme: "twilight" });
    await registerOrLogin(page);
    await expect(page.locator("html")).toHaveClass(/dark/);
    // The palette drives --grad-a at runtime — twilight's violet (#7f5af0) is
    // NOT sunset's orange (#ff7e5f), so the runtime var must differ.
    const gradA = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--grad-a").trim(),
    );
    expect(gradA).toBeTruthy();
    expect(gradA).not.toBe(sunsetGradA);
    await shoot(page, "05-graph-dark-twilight.png");
  });

  test("reduced motion turns the canvas transitions off", async ({ page }) => {
    pinPrefs(page, { mode: "light", theme: "sunset", motion: "off" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await registerOrLogin(page);
    await expect(page.getByTestId("roadmap-canvas")).toHaveAttribute("data-motion", "off");
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    await shoot(page, "06-graph-light-reduced-motion.png");
  });
});
