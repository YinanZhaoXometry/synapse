import { describe, expect, it } from "vitest";
import { clampPage, inRenderWindow, renderWindow, stepPage } from "./pager";

/**
 * Pager math (FR-8; ←/→ primitive) — pure seam, canvas rendering is not
 * component-tested (jsdom). Prior art: display-shaping.test.ts boundary cases.
 */
describe("clampPage", () => {
  it("keeps in-range pages and clamps both ends", () => {
    expect(clampPage(7, 19)).toBe(7);
    expect(clampPage(0, 19)).toBe(1);
    expect(clampPage(-3, 19)).toBe(1);
    expect(clampPage(20, 19)).toBe(19);
  });

  it("a page-less document (total 0) still yields a usable page 1", () => {
    expect(clampPage(5, 0)).toBe(1);
  });
});

describe("stepPage — ←/→", () => {
  it("steps by ±1 and never overshoots the document ends", () => {
    expect(stepPage(7, -1, 19)).toBe(6);
    expect(stepPage(7, 1, 19)).toBe(8);
    expect(stepPage(1, -1, 19)).toBe(1);
    expect(stepPage(19, 1, 19)).toBe(19);
  });

  it("large deltas clamp instead of erroring", () => {
    expect(stepPage(7, -100, 19)).toBe(1);
    expect(stepPage(7, 100, 19)).toBe(19);
  });
});

describe("renderWindow — lazy render / release (FR-8)", () => {
  it("the window spans radius pages either side of the current page", () => {
    expect(renderWindow(7, 19, 2)).toEqual({ from: 5, to: 9 });
  });

  it("the window clamps at the document edges", () => {
    expect(renderWindow(1, 19, 2)).toEqual({ from: 1, to: 3 });
    expect(renderWindow(19, 19, 2)).toEqual({ from: 17, to: 19 });
  });

  it("a short document renders everything; an empty one renders nothing", () => {
    expect(renderWindow(1, 2, 2)).toEqual({ from: 1, to: 2 });
    expect(renderWindow(1, 0, 2)).toEqual({ from: 0, to: 0 });
  });

  it("radius 0 collapses to just the current page; negative radius behaves the same", () => {
    expect(renderWindow(7, 19, 0)).toEqual({ from: 7, to: 7 });
    expect(renderWindow(7, 19, -1)).toEqual({ from: 7, to: 7 });
  });

  it("inRenderWindow decides which pages hold pixels — far pages release", () => {
    const win = renderWindow(7, 19, 2);
    expect(inRenderWindow(6, win)).toBe(true);
    expect(inRenderWindow(9, win)).toBe(true);
    expect(inRenderWindow(4, win)).toBe(false);
    expect(inRenderWindow(10, win)).toBe(false);
  });
});
