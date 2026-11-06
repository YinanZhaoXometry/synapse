import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The live visual smoke (epic-16 T4, ticket 04) — OPT-IN, not part of the
 * default suite: run with
 *
 *   E2E_VISUAL_SMOKE=1 pnpm --dir frontend exec playwright test e2e/visual-smoke.spec.ts
 *
 * while the e2e stack (stub provider) and Vite dev server are up. It drives
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

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 视觉冒烟验证";
const FIRST_NODE = "复杂度分析";

/** Sunset's runtime --grad-a triplet, captured in the dark test and compared
 * against in the twilight test (the palette must actually re-tint). */
let sunsetGradA = "";

test.skip(!RUN, "live visual smoke is opt-in: E2E_VISUAL_SMOKE=1");

test.describe.configure({ mode: "serial" });

function shoot(page: Page, name: string) {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SMOKE_DIR, name), fullPage: true });
}

/** Pins ThemeContext prefs before the app boots (the storage contract, AGENTS.md). */
function pinPrefs(page: Page, prefs: { mode?: string; theme?: string; motion?: string }) {
  const entries = Object.entries(prefs);
  return page.addInitScript((pairs) => {
    for (const [key, value] of pairs) localStorage.setItem(key, value);
  }, entries as [string, string][]);
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

test.describe("the 16-node graph visual matrix", () => {
  test("creation → light/sunset default → fit-view → zoom → node sheet", async ({ page }) => {
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
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("roadmap-node")).toHaveCount(16);

    // Light + sunset (the defaults): the whole plan home with the graph.
    await shoot(page, "01-graph-light-sunset-default.png");

    // Fit-view really rescales the viewport transform (16 nodes overflow the
    // 440px canvas at zoom 1 on a 720p viewport) — the fit zoom lands below 1.
    const viewport = page.getByTestId("roadmap-viewport");
    const before = await viewport.getAttribute("style");
    await page.getByTestId("roadmap-fit").click();
    await expect
      .poll(() => viewport.getAttribute("style"), { timeout: 5_000 })
      .not.toBe(before);
    expect(await viewport.getAttribute("style")).toContain("scale(0.");

    // Zoom in two steps — the scale grows, still clamped under 1.
    await page.getByTestId("roadmap-zoom-in").click();
    await page.getByTestId("roadmap-zoom-in").click();
    const zoomed = await viewport.getAttribute("style");
    expect(zoomed).toContain("scale(0.");
    await shoot(page, "02-graph-light-sunset-fit-zoom.png");

    // The node detail sheet over the graph (description line visible).
    const node = page.getByTestId("roadmap-node").filter({ hasText: FIRST_NODE });
    await expect(node).toHaveCount(1);
    await node.click();
    await expect(page.getByTestId("roadmap-detail")).toBeVisible();
    await expect(page.getByTestId("roadmap-node-desc")).toBeVisible();
    await shoot(page, "03-graph-light-sunset-sheet.png");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("roadmap-detail")).not.toBeVisible({ timeout: 5_000 });
  });

  test("keyboard roving focus moves with arrows and pans off-view nodes into the canvas", async ({
    page,
  }) => {
    await registerOrLogin(page);

    // Seed focus by clicking, close the sheet — Radix restores focus to the node.
    const first = page.getByTestId("roadmap-node").filter({ hasText: FIRST_NODE });
    await first.click();
    await expect(page.getByTestId("roadmap-detail")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("roadmap-detail")).not.toBeVisible({ timeout: 5_000 });

    const activeId = () => page.evaluate(() => document.activeElement?.getAttribute("data-node-id"));
    const activeTitle = () =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? "");

    const startId = await activeId();
    expect(startId).toBeTruthy();

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

    // Enter opens the sheet for the roving-focused node (the keyboard contract).
    await page.keyboard.press("Enter");
    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible();
    const openedTitle = await activeTitle();
    expect(openedTitle!.length).toBeGreaterThan(0);
    await expect(sheet.getByRole("heading", { name: openedTitle! })).toBeVisible();
    await page.keyboard.press("Escape");

    // Far right column, bottom row — off the identity view; arrowing there must
    // PAN it into the canvas (ensureBoxVisible), leaving real DOM focus on it.
    const far = page.getByTestId("roadmap-node").filter({ hasText: "模拟面试复盘" });
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
