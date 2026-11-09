/**
 * i18n dictionary parity — the T5 namespaces (epic P2-8 T5, AD-9): the AI
 * server adapter's mutation-path keys (ai.generate.*) and the SSE stream
 * client's keys (ai.stream.* — the T4 namespace) must exist in BOTH
 * languages with non-empty copy. Same walk as the tasks.* sweep — a future
 * one-sided key fails here instead of surfacing as raw key text. (The
 * creation chat's goal-selection keys retired with epic-27 — the single
 * message subsumes the goal, per FR-1's 2026-11-09 owner amendment.)
 */
import { describe, expect, it } from "vitest";
import { translations } from "./i18n-dictionary";

type Lang = keyof typeof translations;

const PREFIX_NAMESPACES = ["ai.generate.", "ai.stream."];

function t5Keys(lang: Lang): string[] {
  return Object.keys(translations[lang]).filter((key) =>
    PREFIX_NAMESPACES.some((prefix) => key.startsWith(prefix)),
  );
}

describe("i18n dictionary — T5 namespaces zh/en parity (AD-9)", () => {
  it("every ai.generate.* + ai.stream.* key exists in BOTH languages with non-empty copy", () => {
    const zh = t5Keys("zh");
    const en = t5Keys("en");

    // 8 mutation keys + 10 stream keys at least
    expect(zh.length).toBeGreaterThanOrEqual(18);
    // the namespace walk actually caught each prefix (a typo'd prefix would
    // otherwise pass the set equality vacuously with zero keys)
    expect(zh.filter((key) => key.startsWith("ai.generate.")).length).toBeGreaterThanOrEqual(8);
    expect(zh.filter((key) => key.startsWith("ai.stream.")).length).toBeGreaterThanOrEqual(10);
    // set equality, both directions, with the missing keys named
    expect(zh.filter((key) => !en.includes(key))).toEqual([]);
    expect(en.filter((key) => !zh.includes(key))).toEqual([]);

    for (const key of zh) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });
});
