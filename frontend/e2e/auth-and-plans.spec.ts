import { expect, test } from "@playwright/test";

/**
 * The auth wall + the demo account's read-only plan view (S1–S3).
 *
 * Every test stands alone: each registers or logs in through the UI, and the
 * demo-account tests only READ (no writes to the shared demo state — the
 * login rate limiter is per-email 10/60s, two demo logins are safe).
 */

const DEMO_PASSWORD = "e2e-password-123";

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;

test("preflight: the api answers the health query (the e2e compose stack is up)", async ({ request }) => {
  // Polls because a freshly recreated backend (the compose.e2e recipe) answers
  // its container healthcheck before Rails finishes booting.
  await expect(async () => {
    const response = await request.post("http://localhost:3000/graphql", {
      data: { query: "{ health }" },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data?.health).toBeTruthy();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
});

test("S2: an unauthenticated visit bounces to the login wall, and the demo entry lands on Plans Home", async ({
  page,
}) => {
  await page.goto("/plans");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "用演示账号体验" }).click();
  await expect(page).toHaveURL(/\/plans/);
  // On a clean database the demo plan appears in BOTH zones of Plans Home
  // (the continue-learning hero card and the plan list) — first() is the
  // "visible somewhere" assertion; the zones are not the scenario.
  await expect(page.getByText("Software engineering interview prep").first()).toBeVisible();
});

test("S3: the demo account opens its seeded plan — nodes and the server-computed mastery ring render", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "用演示账号体验" }).click();
  await expect(page).toHaveURL(/\/plans/);

  // The DemoSeed shape stub: one private plan, three knowledge nodes with two
  // stage-forward edges (epic-16 T1 seed). Since T3 the plan home renders the
  // roadmap GRAPH by default — node titles are SVG <text> truncated at 18
  // chars, so the FULL title lives in the node's aria-label (the accessible
  // name), which is the honest render assertion for the graph era.
  await page.getByText("Software engineering interview prep").first().click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
  await expect(page.getByRole("button", { name: /Read the architecture spine/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Drill one GraphQL mutation end-to-end/ }).first()).toBeVisible();

  // The mastery display is server-computed (AD-14) — it renders a value; the
  // test never asserts a hand-set score.
  await expect(page.getByRole("img", { name: /掌握度 \d+(\.\d+)?%/ }).first()).toBeVisible();
});

test("S1: registering a fresh account lands inside the app at the creation front door", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(uniqueEmail());
  await page.getByLabel("密码").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "注册并进入" }).click();

  await expect(page).toHaveURL(/\/plans/);
  // The fresh account's front door is the creation chat empty state (FR-1).
  await expect(page.getByText("想学什么？说个主题，我来搭计划。")).toBeVisible();
});
