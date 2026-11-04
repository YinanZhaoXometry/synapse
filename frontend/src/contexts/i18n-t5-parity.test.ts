/**
 * i18n dictionary parity — the T5 namespaces (epic P2-8 T5, AD-9): the AI
 * server adapter's mutation-path keys (ai.generate.*) and the creation chat's
 * goal selection (plans.goalPickerLabel + the four named goals) must exist in
 * BOTH languages with non-empty copy. Same walk as the tasks.* sweep — a
 * future one-sided key fails here instead of surfacing as raw key text.
 */
import { describe, expect, it } from "vitest";
import { translations } from "./i18n-dictionary";

type Lang = keyof typeof translations;

const NAMESPACES = ["ai.generate.", "plans.goalPicker", "plans.goalExam", "plans.goalDeep", "plans.goalRevision", "plans.goalDaily"];

function t5Keys(lang: Lang): string[] {
  return Object.keys(translations[lang]).filter((key) =>
    key.startsWith("ai.generate.") || NAMESPACES.slice(1).some((prefix) => key === prefix),
  );
}

describe("i18n dictionary — T5 namespaces zh/en parity (AD-9)", () => {
  it("every ai.generate.* + goal-selection key exists in BOTH languages with non-empty copy", () => {
    const zh = t5Keys("zh");
    const en = t5Keys("en");

    expect(zh.length).toBeGreaterThanOrEqual(12); // 8 mutation keys + 5 goal keys at least
    // set equality, both directions, with the missing keys named
    expect(zh.filter((key) => !en.includes(key))).toEqual([]);
    expect(en.filter((key) => !zh.includes(key))).toEqual([]);

    for (const key of zh) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("the four named goals + the picker label are present (A3/FR-1 vocabulary)", () => {
    for (const key of ["plans.goalPickerLabel", "plans.goalExam", "plans.goalDeep", "plans.goalRevision", "plans.goalDaily"]) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en ${key}`).toBeTruthy();
    }
  });
});
