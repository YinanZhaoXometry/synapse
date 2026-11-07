import { describe, expect, it, beforeEach } from "vitest";
import { previousNavPathname, recordNavPathname, resetNavHistory, sourceBackTarget } from "./nav-history";

// The one-deep origin recorder (2026-11-06 nav fix): spine-owned surfaces
// (reader / quiz session / flashcards study) derive a source-aware back from
// the PREVIOUS in-app pathname. Module-scoped state — reset between specs.
beforeEach(resetNavHistory);

describe("nav-history recorder", () => {
  it("keeps one-deep previous as the app navigates", () => {
    expect(previousNavPathname()).toBeNull();
    recordNavPathname("/materials");
    expect(previousNavPathname()).toBeNull(); // first nav has no previous
    recordNavPathname("/read/mat-1");
    expect(previousNavPathname()).toBe("/materials");
    recordNavPathname("/plans");
    expect(previousNavPathname()).toBe("/read/mat-1");
  });

  it("dedupes same-route records (query/anchor tweaks never bump previous)", () => {
    recordNavPathname("/materials");
    recordNavPathname("/read/mat-1?page=3");
    recordNavPathname("/read/mat-1?page=3&hl=7");
    expect(previousNavPathname()).toBe("/materials");
  });
});

describe("sourceBackTarget — the hub/task origins that need the override", () => {
  it("labels retained-hub origins with their nav key", () => {
    expect(sourceBackTarget("/materials")).toEqual({ to: "/materials", labelKey: "nav.materials" });
    expect(sourceBackTarget("/mistakes")).toEqual({ to: "/mistakes", labelKey: "nav.mistakes" });
    expect(sourceBackTarget("/ai-tutor")).toEqual({ to: "/ai-tutor", labelKey: "nav.tutor" });
    expect(sourceBackTarget("/quiz")).toEqual({ to: "/quiz", labelKey: "nav.quiz" });
    expect(sourceBackTarget("/flashcards")).toEqual({ to: "/flashcards", labelKey: "nav.flashcards" });
    expect(sourceBackTarget("/planner")).toEqual({ to: "/planner", labelKey: "nav.planner" });
    expect(sourceBackTarget("/plans")).toEqual({ to: "/plans", labelKey: "nav.plans" });
  });

  it("returns the task home (the reader's fallback loses task context — defect #2)", () => {
    expect(sourceBackTarget("/task/task-1")).toEqual({ to: "/task/task-1", labelKey: "tasks.backToTask" });
  });

  it("does NOT treat the creation surface as a task home — /task/new falls to the spine default", () => {
    // A just-created task's reader "back" must reach the plans home (where the
    // new task's card lives), never the emptied creation form — pinned when
    // the destinations.spec task-promotion e2e timed out on the 所有计划
    // locator this over-match had renamed to 返回任务.
    expect(sourceBackTarget("/task/new")).toBeNull();
  });

  it("returns null for the spine defaults the callers already own", () => {
    expect(sourceBackTarget("/plan/plan-1")).toBeNull(); // reader default: topic-labeled plan back
    expect(sourceBackTarget("/plan/plan-1/quiz")).toBeNull(); // quiz-session default: homeHref
    expect(sourceBackTarget("/read/other")).toBeNull(); // reader → reader citation jumps
    expect(sourceBackTarget(null)).toBeNull(); // fresh tab / reload
    expect(sourceBackTarget("/onboarding")).toBeNull(); // unmapped — honest fallback
  });
});
