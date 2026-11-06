import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installPointerEventShim } from "@/test/pointer-event-shim";

// AppLayout reads the server streak (AD-14) — the drawer contract has nothing
// to do with the wire, so pin the hook to honest-empty instead of mounting
// Apollo.
vi.mock("@/api", () => ({ useStreakQuery: () => ({ data: undefined }) }));
// The palette is mounted beside the drawer but is its own surface (⌘K tests
// live elsewhere) — render it out so `role="dialog"` stays the drawer's alone.
vi.mock("@/components/shared/CommandPalette", () => ({ CommandPalette: () => null }));

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./AppLayout";

// jsdom 20 predates PointerEvent — the swipe contract keys the gesture by
// pointerId, which the bare MouseEvent constructor would silently drop.
installPointerEventShim();

const renderLayout = () =>
  render(
    <LanguageProvider>
      <ThemeProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="*" element={<div>page-stub</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </LanguageProvider>
  );

const hamburger = () => screen.getByRole("button", { name: "打开导航" });
const openDrawer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(hamburger());
  return screen.getByRole("dialog");
};

beforeEach(() => {
  localStorage.clear();
});

describe("AppLayout mobile drawer (epic-20 T2: the first drawer tests)", () => {
  it("opens via the hamburger and aria-expanded tracks the state", async () => {
    const user = userEvent.setup();
    renderLayout();
    expect(hamburger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(hamburger());

    expect(screen.getByRole("dialog", { name: "Synapse 导航" })).toBeInTheDocument();
    expect(hamburger()).toHaveAttribute("aria-expanded", "true");
  });

  it("a tap (down + up, no meaningful drag) does not close the drawer", () => {
    renderLayout();
    fireEvent.click(hamburger());
    const dialog = screen.getByRole("dialog");

    fireEvent.pointerDown(dialog, { pointerId: 7, clientX: 200, clientY: 40 });
    fireEvent.pointerUp(dialog, { pointerId: 7, clientX: 200, clientY: 40 });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("scrim click closes", async () => {
    const user = userEvent.setup();
    renderLayout();
    await openDrawer(user);

    await user.click(screen.getByTestId("drawer-scrim"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hamburger()).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape closes", async () => {
    const user = userEvent.setup();
    renderLayout();
    await openDrawer(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a drawer nav-link click closes (the nav-close path)", async () => {
    const user = userEvent.setup();
    renderLayout();
    const dialog = await openDrawer(user);

    await user.click(within(dialog).getByRole("link", { name: "仪表盘" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a drawer search-pill click closes", async () => {
    const user = userEvent.setup();
    renderLayout();
    const dialog = await openDrawer(user);

    await user.click(within(dialog).getByRole("button", { name: /搜索或命令/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a drawer footer (settings gear) click closes", async () => {
    const user = userEvent.setup();
    renderLayout();
    const dialog = await openDrawer(user);

    await user.click(within(dialog).getByRole("link", { name: "设置" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AppLayout drawer swipe-to-close (epic-20 T2)", () => {
  /**
   * The dismiss threshold is min(40% of the panel width, 120px) against the
   * panel's real width — jsdom reports 0, so pin the drawer's 290px width
   * (threshold = min(116, 120) = 116). The pointer sequence starts at
   * (200, 40) INSIDE the panel and drags horizontally by `dx`.
   */
  const pinPanelWidth = () => {
    const el = screen.getByRole("dialog");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      width: 290,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 290,
      bottom: 600,
      toJSON: () => ({}),
    } as DOMRect);
    return el;
  };
  const dragTo = (el: Element, dx: number, pointerId = 7) => {
    fireEvent.pointerDown(el, { pointerId, clientX: 200, clientY: 40 });
    fireEvent.pointerMove(el, { pointerId, clientX: 200 + dx, clientY: 40 });
  };
  const swipe = (dx: number) => {
    const el = pinPanelWidth();
    dragTo(el, dx);
    fireEvent.pointerUp(el, { pointerId: 7, clientX: 200 + dx, clientY: 40 });
    return el;
  };

  it("tracks the horizontal drag on the panel transform (leftward only — rightward clamps at 0)", () => {
    renderLayout();
    fireEvent.click(hamburger());
    const el = pinPanelWidth();

    dragTo(el, -160);
    expect(el.style.transform).toBe("translateX(-160px)");

    // Drag right from there: the panel is fully open, so it clamps at 0.
    dragTo(el, 30);
    expect(el.style.transform).toBe("translateX(0px)");
  });

  it("a swipe past the threshold (min(40%·w, 120) = 116 here) dismisses the drawer", () => {
    renderLayout();
    fireEvent.click(hamburger());

    swipe(-160);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hamburger()).toHaveAttribute("aria-expanded", "false");
  });

  it("a swipe below the threshold springs back to translateX(0) with the spring transition (motion on)", () => {
    renderLayout();
    fireEvent.click(hamburger());

    swipe(-70);

    const el = screen.getByRole("dialog");
    expect(el).toBeInTheDocument();
    expect(el.style.transform).toBe("translateX(0px)");
    expect(el.style.transition).toContain("transform");
    expect(el).toHaveAttribute("data-motion", "on");
  });

  it("reduce-motion: the spring back is instant (no transition) and data-motion=off rides the panel", () => {
    localStorage.setItem("synapse-motion", "off");
    renderLayout();
    fireEvent.click(hamburger());
    expect(screen.getByRole("dialog")).toHaveAttribute("data-motion", "off");

    swipe(-70);

    const el = screen.getByRole("dialog");
    expect(el.style.transform).toBe("translateX(0px)");
    expect(el.style.transition).toBe("");
  });

  it("pointercancel (the browser took the gesture — e.g. it turned into a vertical scroll) aborts: stays open, springs back, never dismisses", () => {
    renderLayout();
    fireEvent.click(hamburger());
    const el = pinPanelWidth();

    dragTo(el, -160);
    fireEvent.pointerCancel(el, { pointerId: 7 });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(el.style.transform).toBe("translateX(0px)");
  });

  it("the panel opts horizontal gestures out to JS while keeping vertical scroll native (touch-action: pan-y)", () => {
    renderLayout();
    fireEvent.click(hamburger());

    expect(screen.getByRole("dialog").style.touchAction).toBe("pan-y");
  });

  it("after a spring-back, a plain tap still works — the drawer's nav-close path stays live (a stale springBack must not swallow clicks)", async () => {
    const user = userEvent.setup();
    renderLayout();
    fireEvent.click(hamburger());
    swipe(-70);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // A fresh tap on a nav link: the new gesture must reset the spring-back
    // posture, or the click-capture guard would keep swallowing every later
    // click in the drawer.
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "仪表盘" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the entrance animation never replays mid-session: a tap after a spring-back does not restore its classes", () => {
    renderLayout();
    fireEvent.click(hamburger());
    const el = screen.getByRole("dialog");
    expect(el).toHaveClass("animate-in"); // a fresh open carries the entrance

    swipe(-70);
    expect(el).not.toHaveClass("animate-in"); // the swipe posture dropped it

    // A tap's pointerdown resets the spring-back posture — restoring the
    // entrance classes here would REPLAY the slide-in in a real browser
    // (the panel teleports off-screen mid-tap and eats the pointerup; found
    // by the T3 real-browser smoke, invisible to jsdom's animation-less
    // engine). The classes come back only on the next fresh OPEN.
    fireEvent.pointerDown(el, { pointerId: 7, clientX: 200, clientY: 40 });
    fireEvent.pointerUp(el, { pointerId: 7, clientX: 200, clientY: 40 });
    expect(el).not.toHaveClass("animate-in");
  });

  it("a second finger's lift does not settle the gesture — only the swipe's own pointer can end it", () => {
    renderLayout();
    fireEvent.click(hamburger());
    const el = pinPanelWidth();

    dragTo(el, -160);
    fireEvent.pointerUp(el, { pointerId: 8, clientX: 40, clientY: 40 });
    expect(el.style.transform).toBe("translateX(-160px)");

    fireEvent.pointerUp(el, { pointerId: 7, clientX: 40, clientY: 40 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reopening after a swipe cycle starts clean — no residual drag transform or spring transition", async () => {
    const user = userEvent.setup();
    renderLayout();
    fireEvent.click(hamburger());
    swipe(-70);
    expect(screen.getByRole("dialog").style.transition).toContain("transform");

    await user.click(screen.getByTestId("drawer-scrim"));
    await user.click(hamburger());

    const el = screen.getByRole("dialog");
    expect(el.style.transform).toBe("");
    expect(el.style.transition).toBe("");
  });
});

