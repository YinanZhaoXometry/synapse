import { describe, expect, it } from "vitest";
import { resolveEntryDestination } from "./entry-decision";

/**
 * Entry-state decision (AD-8; spec testing seam 1): the pure
 * flag → destination mapping. Since the Apollo cutover (epic P2-8 T1) the
 * onboarding-complete flag's storage owner changed (server account state, not
 * the local document) — the decision itself stays a pure boolean→destination
 * function, and these tests exercise it directly with booleans.
 */
describe("entry-state decision (seam: onboarding-complete → destination, AD-8)", () => {
  it("first run: never onboarded → the onboarding wizard", () => {
    expect(resolveEntryDestination(false)).toBe("onboarding");
  });

  it("returning visit: onboarding already complete → Plans Home, wizard never repeats", () => {
    expect(resolveEntryDestination(true)).toBe("plans");
  });

  it("post-completion: the flag turning true re-points the entry to Plans Home", () => {
    // fresh account: the flag starts false
    let onboardingComplete = false;
    expect(resolveEntryDestination(onboardingComplete)).toBe("onboarding");
    onboardingComplete = true; // completion flips the flag once, permanently
    expect(resolveEntryDestination(onboardingComplete)).toBe("plans");
  });
});
