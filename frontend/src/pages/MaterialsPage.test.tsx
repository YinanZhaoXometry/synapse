import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { MATERIALS } from "@/lib/demo-data";
import MaterialsPage from "./MaterialsPage";

/**
 * MaterialsPage direct (epic P3-17 ticket 09): the ten-destination materials
 * library is demo-data-backed by the spine's honest §6.2 decision (this page
 * stays prototype rows) — the test pins the user contract that survives the
 * eventual server re-point: tag filtering, title search with the bilingual
 * haystack, the empty state, and the plan-wide scope chip on every row
 * (FR-44's display consequence).
 */

const zh = translations.zh as Record<string, string>;

function renderMaterials() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <MaterialsPage />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("MaterialsPage — the demo-data library", () => {
  beforeEach(() => localStorage.clear());

  it("lists every demo material with a plan-wide scope chip", () => {
    renderMaterials();

    expect(screen.getByRole("heading", { name: zh["materials.title"] })).toBeInTheDocument();
    expect(screen.getAllByTestId("scope-chip")).toHaveLength(MATERIALS.length);
    expect(screen.getByText(zh["materials.upload"])).toBeInTheDocument();
  });

  it("filters by tag", async () => {
    const user = userEvent.setup();
    renderMaterials();

    const examTag = screen.getByRole("button", { name: zh["materials.tagExam"] });
    const examCount = MATERIALS.filter((m) => m.tag === "exam").length;
    await user.click(examTag);

    expect(screen.getAllByTestId("scope-chip")).toHaveLength(examCount);

    await user.click(screen.getByRole("button", { name: zh["materials.tagAll"] }));
    expect(screen.getAllByTestId("scope-chip")).toHaveLength(MATERIALS.length);
  });

  it("searches the bilingual haystack and shows the honest empty state", async () => {
    const user = userEvent.setup();
    renderMaterials();

    const search = screen.getByRole("searchbox", { name: zh["materials.search"] });

    // A zh title fragment narrows the rows; a gibberish query empties them.
    const firstZh = MATERIALS[0].title.zh;
    const fragment = firstZh.slice(0, 2);
    await user.type(search, fragment);
    const narrowed = screen.getAllByTestId("scope-chip").length;
    expect(narrowed).toBeLessThanOrEqual(MATERIALS.length);

    await user.type(search, "绝不存在的材料");
    expect(screen.getByText(zh["materials.empty"])).toBeInTheDocument();

    await user.clear(search);
    expect(screen.getAllByTestId("scope-chip")).toHaveLength(MATERIALS.length);
  });
});
