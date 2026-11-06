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
  // The topic renders TWICE on a fresh account's Plans Home — the resume-hero
  // card AND the plan row are both the demo plan there. Anchor on the row
  // button (its accessible name STARTS with the topic; the hero's starts with
  // 掌握度). First CI run caught this: locally the demo user's older plans
  // occupy the hero slot, so the old getByText only ever matched one element.
  await expect(
    page.getByRole("button", { name: /^Software engineering interview prep/ })
  ).toBeVisible();
});

test("S3: the demo account opens its seeded plan — nodes and the server-computed mastery ring render", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "用演示账号体验" }).click();
  await expect(page).toHaveURL(/\/plans/);

  // The DemoSeed shape stub: one private plan, two knowledge nodes. Node
  // titles render in BOTH the list view and the roadmap graph — first() is
  // the assertion (visible somewhere), the views are not the scenario.
  await page.getByText("Software engineering interview prep").first().click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
  await expect(page.getByText("Read the architecture spine").first()).toBeVisible();
  await expect(page.getByText("Drill one GraphQL mutation end-to-end").first()).toBeVisible();

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
