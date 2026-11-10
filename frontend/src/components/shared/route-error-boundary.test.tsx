/**
 * The route error boundary (2026-11-10): a failed lazy chunk renders the
 * recovery card (never a white screen), any other error gets the same card
 * with the raw message visible in dev, the reload button reloads, and
 * navigation resets the boundary so one crashed page can't brick the next.
 */
import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import RouteErrorBoundary from "./route-error-boundary";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

/** The live Chrome phrasing for a failed lazy chunk (the dev 504 / prod 404). */
const CHUNK_ERROR = () =>
  new TypeError("Failed to fetch dynamically imported module: http://localhost:8080/src/pages/X.tsx");

function Bad({ error }: { error: Error }): ReactNode {
  throw error;
}

function renderHarness(badError: Error) {
  return render(
    <MemoryRouter initialEntries={["/bad"]}>
      <MockedProvider>
        <LanguageProvider>
          {/* The link sits OUTSIDE the boundary — a crash inside must not
              take the navigation affordance down with it in this harness. */}
          <div>
            <Link to="/good" data-testid="go-good">go</Link>
            <RouteErrorBoundary>
              <Routes>
                <Route path="/bad" element={<Bad error={badError} />} />
                <Route path="/good" element={<div data-testid="good-page">good</div>} />
              </Routes>
            </RouteErrorBoundary>
          </div>
        </LanguageProvider>
      </MockedProvider>
    </MemoryRouter>,
  );
}

describe("RouteErrorBoundary (2026-11-10)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  // jsdom's location.reload is non-redefinable — replace the whole
  // window.location with a stubbed twin (the component reads only reload).
  const reloadFn = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: Object.assign(Object.create(Object.getPrototypeOf(window.location)), window.location, { reload: reloadFn }),
  });

  beforeEach(() => {
    reloadFn.mockClear();
    // getDerivedStateFromError logging must not dirty the test output.
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("a failed lazy chunk renders the update recovery card — not a white screen", () => {
    renderHarness(CHUNK_ERROR());
    expect(screen.getByTestId("route-error-boundary")).toBeInTheDocument();
    expect(screen.getByText(zhDict["errors.routeUpdateTitle"])).toBeInTheDocument();
    expect(screen.getByText(zhDict["errors.routeUpdateBody"])).toBeInTheDocument();
    // Chunk failures are environmental — no raw message in the card.
    expect(screen.queryByText(CHUNK_ERROR().message)).not.toBeInTheDocument();
  });

  it("any other error gets the generic card with the raw message in dev", () => {
    renderHarness(new Error("boom in a lazy page"));
    expect(screen.getByText(zhDict["errors.routeCrashed"])).toBeInTheDocument();
    // DEV build (vitest) shows the message — the HMR overlay is disabled, so
    // the card is the only in-page trace of a render crash.
    expect(screen.getByText("boom in a lazy page")).toBeInTheDocument();
  });

  it("the reload button reloads the page", async () => {
    const user = userEvent.setup();
    renderHarness(CHUNK_ERROR());
    await user.click(screen.getByTestId("route-reload"));
    expect(reloadFn).toHaveBeenCalledTimes(1);
  });

  it("navigation resets the boundary — a crashed page never bricks the next", async () => {
    const user = userEvent.setup();
    renderHarness(CHUNK_ERROR());
    expect(screen.getByTestId("route-error-boundary")).toBeInTheDocument();

    await user.click(screen.getByTestId("go-good"));
    await waitFor(() => expect(screen.getByTestId("good-page")).toBeInTheDocument());
    expect(screen.queryByTestId("route-error-boundary")).not.toBeInTheDocument();
  });
});
