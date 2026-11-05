/**
 * Architecture guard (epic P2-8 T1, AC grep-guard): the Apollo cutover retired
 * TanStack Query and the src/data adapter from the runtime — these greps keep
 * them retired. A re-introduction fails the suite and names the file that
 * broke the rule.
 *
 * Also pinned: nothing touches the legacy local document key outside
 * src/lib/local-document.ts (its readers are the entry gate and ticket 03's
 * first-login import; the document itself is never deleted — AD-20), and —
 * since epic P2-09 T6 — the demo progress context
 * (src/contexts/UserProgressContext.tsx) stays DELETED (epic-08's A1
 * retirement completed there): no import of the module, no hook call, no
 * provider wiring, anywhere in src (tests included — a planted reference
 * must fail this suite, which the self-proof below demonstrates).
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
  // The demo progress context died with epic P2-09 T6 (A1 completion). The
  // rule pins the name in its three EFFECTIVE forms — the module path (every
  // import/mock/dynamic import must carry it), the hook call, and the provider
  // element. Bare-word matching would false-positive the residue assertions
  // in the page tests (regex literals naming the very names they forbid), so
  // the shapes are chosen to catch every real reference while leaving honest
  // prose alone.
  {
    pattern: /@\/contexts\/UserProgressContext/,
    reason: "UserProgressContext is DELETED (epic P2-09 T6, A1 completion) — the demo progress context is retired; use the typed hooks layer (src/api)",
  },
  {
    pattern: /\buseUserProgress\s*\(/,
    reason: "useUserProgress() is retired with its context (epic P2-09 T6) — server fields come from the typed hooks layer (src/api)",
  },
  {
    pattern: /\bUserProgressProvider\b/,
    reason: "UserProgressProvider is retired with its context (epic P2-09 T6) — no demo progress wiring exists",
  },
];

describe("architecture guard (epic P2-8 T1)", () => {
  // the enforcer skips itself — its rule literals match their own patterns
  const files = collectFiles(SRC_ROOT).filter((file) => !file.endsWith("architecture.guard.test.ts"));

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

  // The enforcer is itself under test (T6): a planted reference must be
  // caught by every retired-progress rule — prove the guard bites (the
  // planted literals live HERE, in the file the scan skips).
  it("the retired-progress rules catch a planted reference (self-proof)", () => {
    const planted = [
      'import { useUserProgress } from "@/contexts/UserProgressContext";',
      'import { UserProgressProvider } from "@/contexts/UserProgressContext";',
      'const ctx = useUserProgress();',
      '<UserProgressProvider><App /></UserProgressProvider>',
    ];
    const progressRules = RULES.filter((rule) => rule.reason.includes("P2-09 T6"));
    expect(progressRules.length).toBe(3);
    for (const rule of progressRules) {
      const caught = planted.filter((line) => rule.pattern.test(line));
      expect(caught.length, `rule ${rule.pattern} caught nothing`).toBeGreaterThanOrEqual(1);
    }
    // and a clean module matches none of them
    const clean = 'import { useLanguage } from "@/contexts/LanguageContext";';
    for (const rule of progressRules) {
      expect(rule.pattern.test(clean), `false positive on clean source: ${rule.pattern}`).toBe(false);
    }
  });
});
