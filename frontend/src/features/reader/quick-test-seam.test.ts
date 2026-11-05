/**
 * The Quick Test seam (FR-13, epic-13 T1): the selection bar's 快测 action
 * dispatches the captured scope through a REGISTERED handler — T2's flow (the
 * next ticket in this epic) fills the registration. Until then the dispatch
 * reports honestly false and the bar toasts 「快测将在下一步开放」 instead of a
 * dead affordance. Pinned here: register → dispatch delivers the scope and
 * reports true; without a handler dispatch reports false; unregister restores
 * the unhandled state; the latest registration wins (one handler slot).
 */
import { describe, expect, it, vi } from "vitest";
import { dispatchQuickTest, registerQuickTestHandler, type QuickTestScope } from "./quick-test-seam";

const scope: QuickTestScope = {
  materialId: "mat-1",
  selection: { kind: "markdown", sectionId: "sec-1", text: "selected words" },
};

describe("the Quick Test feature-flag seam (epic-13 T1 → T2 handoff)", () => {
  it("reports false with no handler registered (T2 has not landed)", () => {
    expect(dispatchQuickTest(scope)).toBe(false);
  });

  it("delivers the scope to the registered handler and reports true", () => {
    const handler = vi.fn();
    const unregister = registerQuickTestHandler(handler);

    expect(dispatchQuickTest(scope)).toBe(true);
    expect(handler).toHaveBeenCalledWith(scope);

    unregister();
    expect(dispatchQuickTest(scope)).toBe(false);
  });

  it("keeps ONE handler slot — the latest registration wins", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerQuickTestHandler(first);

    const unregisterSecond = registerQuickTestHandler(second);
    unregisterFirst(); // stale registration disposed after being replaced

    expect(dispatchQuickTest(scope)).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(scope);

    unregisterSecond();
  });
});
