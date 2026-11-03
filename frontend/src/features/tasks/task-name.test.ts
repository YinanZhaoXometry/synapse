import { describe, expect, it } from "vitest";
import { resolveTaskName } from "./task-name";

/**
 * Task-name rule (T1 AC): the optional name input pre-fills from the filename
 * and is editable; confirming it blank falls back to the filename-derived
 * title — a task is never created nameless. Pure seam. Prior art:
 * plans/upload-validation.test.ts (whose titleFromFilename is the fallback).
 */
describe("resolveTaskName", () => {
  it("keeps an edited non-blank name", () => {
    expect(resolveTaskName("期末复习讲义", "lecture-04.pdf")).toBe("期末复习讲义");
    expect(resolveTaskName("Week 3 reading", "whatever.md")).toBe("Week 3 reading");
  });

  it("trims surrounding whitespace off an edited name", () => {
    expect(resolveTaskName("  Notes  ", "a.md")).toBe("Notes");
  });

  it("falls back to the filename title when the confirmed name is blank", () => {
    expect(resolveTaskName("", "lecture-04.pdf")).toBe("lecture-04");
    expect(resolveTaskName("   ", "论文草稿.markdown")).toBe("论文草稿");
  });
});
