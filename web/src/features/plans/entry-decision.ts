/**
 * Entry-state decision (AD-8; spec testing seam 1): pure function from the
 * onboarding-complete flag to the destination a visit to the root resolves to.
 * No I/O, no React — the gate component in App.tsx applies the answer.
 */

/** Where the root sends a learner who has not completed onboarding. */
export type EntryDestination = "onboarding" | "plans";

/** The front door once onboarding is complete (AD-8). */
export const PLANS_HOME_ROUTE = "/plans";

export function resolveEntryDestination(onboardingComplete: boolean): EntryDestination {
  return onboardingComplete ? "plans" : "onboarding";
}
