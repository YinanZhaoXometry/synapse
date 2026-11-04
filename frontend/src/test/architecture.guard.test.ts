/**
 * Architecture guard (epic P2-8 T1, AC grep-guard): the Apollo cutover retired
 * TanStack Query and the src/data adapter from the runtime — these greps keep
 * them retired. A re-introduction fails the suite and names the file that
 * broke the rule.
 *
 * Also pinned: nothing touches the legacy local document key outside
 * src/lib/local-document.ts (its readers are the entry gate and ticket 03's
 * first-login import; the document itself is never deleted — AD-20).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..");
const EXTS = [".ts", ".tsx"];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
    } else if (EXTS.some((ext) => name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const RULES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /@tanstack/,
    reason: "TanStack Query retired at the Apollo cutover (AD-18) — use the typed hooks layer",
  },
  {
    pattern: /from ["'][./]*(@\/)?data\//,
    reason: "src/data adapter retired at the Apollo cutover (AD-18)",
  },
  {
    pattern: /synapse-db:v1/,
    reason:
      "the legacy local document key is readable only through src/lib/local-document.ts (entry gate + T3 import); it is never written client-side again",
  },
];

describe("architecture guard (epic P2-8 T1)", () => {
  const files = collectFiles(SRC_ROOT);

  it("keeps the retired data layer retired", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(SRC_ROOT, file);
      const source = readFileSync(file, "utf8");
      for (const rule of RULES) {
        // local-document.ts owns the legacy key — it is the one allowed reader
        if (rule.pattern.source.includes("synapse-db") && rel === "lib" + "/local-document.ts") continue;
        if (rule.pattern.test(source)) {
          violations.push(`${rel}: ${rule.reason}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
