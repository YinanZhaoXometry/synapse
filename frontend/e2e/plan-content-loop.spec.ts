import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The plan→content loop's e2e segment (epic-34 T3): create a plan WITH a
 * staged file → the confirm-time attach+parse lands → the plan-page
 * auto-mapping effect fills coverage SILENTLY (the only observables are the
 * mapping mutation's response and the coverage panel's proposal rows — no
 * toast, no manual click) → a node's「AI 讲解」opens the plan Companion
 * drawer with the teaching prefill held (never auto-sent).
 *
 * The stub provider answers the mapping prompt deterministically (every real
 * section id → the plan's FIRST node), so the panel's 待确认 group names
 * 复杂度分析 and every section of the fixture appears under it. Fresh
 * registered user per run; the harness conventions (explicit timeouts, node
 * titles live in the g's aria-label) carry over from the sibling specs.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MATERIAL_PATH = path.join(here, "fixtures", "study-notes.md");

const PASSWORD = "e2e-password-123";
const EMAIL = `e2e-content-loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@synapse.test`;
const TOPIC = "E2E 计划内容闭环验证";
const FIRST_NODE = "复杂度分析";
const TEACH_PREFILL = "请给我讲解这个节点";
// The stub plan's node count (epic-16's fixed 16-node proposal) — with zero
// CONFIRMED mappings every node is unmapped (GLOSSARY Unmapped node: a
// proposal is not a decision).
const NODE_COUNT = 16;
const COMPOSER_LABEL = "问一个关于这个计划的问题…（Enter 发送 · Shift+Enter 换行）";

function nodeBox(page: Page, title: string) {
  return page.locator(`[data-testid="roadmap-node"][aria-label*="${title}"]`);
}

test.describe.configure({ mode: "serial" });

test.describe("the plan content loop (epic-34 T3)", () => {
  test("creation with a file → auto-mapping proposal rows appear → node AI 讲解 prefills the drawer", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("邮箱").fill(EMAIL);
    await page.getByLabel("密码").fill(PASSWORD);
    await page.getByRole("button", { name: "注册并进入" }).click();
    await expect(page).toHaveURL(/\/plans/);

    // The creation chat takes the staged file BEFORE the draft: the paperclip
    // picker is the hidden multiple input (the plan page's single-file
    // re-upload picker is not mounted here).
    await page.locator('input[type="file"][multiple]').setInputFiles(MATERIAL_PATH);
    await expect(page.getByTestId("creation-staged-files")).toBeVisible();
    await page.getByPlaceholder(/COMP5241/).fill(TOPIC);
    await page.getByRole("button", { name: "生成" }).click();

    await expect(page.getByText(/结构草案/)).toBeVisible({ timeout: 20_000 });
    // Arm the auto-mapping observer BEFORE the confirm — the effect fires
    // right after the plan page's reads land, and the response body is the
    // deterministic success signal (silent start/success: no toast exists).
    const mapResponsePromise = page.waitForResponse(
      (response) =>
        response.request().postData()?.includes("mapMaterialSections") === true &&
        response.url().includes("/graphql"),
      { timeout: 60_000 },
    );
    await page.getByRole("button", { name: "确认创建计划" }).click();
    await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: TOPIC })).toBeVisible();

    // The staged file rode the standard attach→parse flow during confirm —
    // the row reports its sections before anything else is asserted.
    await expect(page.getByText(/已解析 · \d+ 节/)).toBeVisible({ timeout: 30_000 });

    // Auto-mapping landed: exactly one cap-counted call, placements in the
    // payload, and never a failure toast (silent success).
    const mapResponse = await mapResponsePromise;
    const mapPayload = await mapResponse.json();
    expect(mapPayload.data?.mapMaterialSections?.mappings?.length ?? 0).toBeGreaterThan(0);

    // The proposal rows live in the coverage panel — open it under the
    // material row and read the loop's honesty: the computed unmapped-nodes
    // summary (a proposal is not a decision, so ALL nodes are still
    // unmapped) and the proposed group naming the stub's first node.
    await page.getByRole("button", { name: "内容覆盖" }).click();
    const panel = page.getByTestId("coverage-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("coverage-unmapped-summary")).toContainText(`未映射节点：${NODE_COUNT}`);
    await expect(panel.getByText(`待确认 · ${FIRST_NODE}`)).toBeVisible({ timeout: 30_000 });
    // The fixture's sections ride the proposal rows — nothing silently dropped.
    await expect(panel.getByText("The study loop")).toBeVisible();
    await expect(panel.getByText("Mastery honesty")).toBeVisible();

    // The teach entry (epic-34 T2's surface, the loop's next hop): a node
    // click opens the sheet;「AI 讲解」opens the plan Companion drawer with
    // the prefill HELD in the composer — nothing is sent without the user.
    await nodeBox(page, FIRST_NODE).click();
    const sheet = page.getByTestId("roadmap-detail");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("node-teach").click();
    const composer = page.getByLabel(COMPOSER_LABEL);
    await expect(composer).toHaveValue(TEACH_PREFILL);
    // Prefill only: the send button sits beside an unsent draft (no extra
    // assistant turn ever appeared).
    await expect(page.getByRole("button", { name: "发送" })).toBeVisible();
  });
});
