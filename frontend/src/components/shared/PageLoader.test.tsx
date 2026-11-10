/**
 * The shared page-loading state (epic-28 T3): the a11y contract (role/aria)
 * and the bilingual label. The page-swap behavior is pinned at one
 * representative surface in the page walks; the component itself stays dumb.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import PageLoader from "./PageLoader";

describe("PageLoader (epic-28 T3)", () => {
  it("announces the wait: role=status, aria-busy, the bilingual label", () => {
    render(
      <LanguageProvider>
        <PageLoader />
      </LanguageProvider>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });
});
