import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The roadmap skin guard (epic-28): the copied roadmap.sh palette lives in
 * CSS VARIABLES ONLY (index.css :root) — the renderer references tokens and
 * must never hardcode a hex/rgb color (theme discipline; the dark mode
 * contract depends on it). A new raw color in RoadmapGraph.tsx fails here.
 */
describe("roadmap skin token discipline", () => {
  it("RoadmapGraph.tsx carries zero raw color literals", () => {
    const source = readFileSync(join(__dirname, "RoadmapGraph.tsx"), "utf8");
    // Comments may NARRATE the skin (prose pointing at index.css) — strip
    // them before the scan so only live code is judged.
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    const violations = code.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(violations, `raw colors leaked into the renderer: ${violations.join(", ")}`).toEqual([]);
  });

  it("the copied values exist as tokens in index.css (the skin's single home)", () => {
    const css = readFileSync(join(__dirname, "../../index.css"), "utf8");
    for (const token of [
      "--roadmap-hub-face: #fdff00",
      "--roadmap-leaf-face: #ffe599",
      "--roadmap-edge: #2b78e4",
      "--roadmap-node-border: #000000",
      "--roadmap-mark-learning: #2b78e4",
      "--roadmap-mark-finished: #1e9e5a",
      "--roadmap-mark-skipped: #9aa0a6",
    ]) {
      expect(css).toContain(token);
    }
  });
});
