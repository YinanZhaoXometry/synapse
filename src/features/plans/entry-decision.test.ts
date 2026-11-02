import { beforeEach, describe, expect, it } from "vitest";
import { isOnboardingComplete, markOnboardingComplete } from "@/data";
import { resolveEntryDestination } from "./entry-decision";

beforeEach(() => {
  localStorage.clear();
});

describe("entry-state decision (seam: onboarding-complete → destination, AD-8)", () => {
  it("first run: never onboarded → the onboarding wizard", () => {
    expect(resolveEntryDestination(false)).toBe("onboarding");
  });

  it("returning visit: onboarding already complete → Plans Home, wizard never repeats", () => {
    expect(resolveEntryDestination(true)).toBe("plans");
  });

  it("post-completion: persisting the completion flag re-points the entry to Plans Home", () => {
    expect(isOnboardingComplete()).toBe(false); // fresh store starts un-onboarded
    markOnboardingComplete();
    expect(resolveEntryDestination(isOnboardingComplete())).toBe("plans");
  });
});
