/**
 * i18n dictionary parity — the quiz.* plan-flow additions (epic-6 T2, AD-9;
 * the tasks.* sweep precedent): every quiz.* key present in one language
 * table must exist in the other, with non-empty copy on both sides. A future
 * key added to only one language fails here instead of surfacing as raw key
 * text in the quiz surfaces.
 */
import { describe, expect, it } from "vitest";
import { translations } from "@/contexts/i18n-dictionary";

type Lang = keyof typeof translations;

function quizKeys(lang: Lang): string[] {
  return Object.keys(translations[lang]).filter((key) => key.startsWith("quiz."));
}

describe("i18n dictionary — quiz.* zh/en parity (AD-9)", () => {
  it("every quiz.* key exists in BOTH languages with non-empty copy", () => {
    const zh = quizKeys("zh");
    const en = quizKeys("en");

    expect(zh.length).toBeGreaterThan(0); // the namespace exists at all
    // set equality, both directions, with the missing keys named
    expect(zh.filter((key) => !en.includes(key))).toEqual([]);
    expect(en.filter((key) => !zh.includes(key))).toEqual([]);

    for (const key of zh) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("the T2 plan-flow additions are present (launcher/runner/results vocabulary)", () => {
    const required = [
      "quiz.launcher.title",
      "quiz.launcher.generating",
      "quiz.launcher.needMaterial",
      "quiz.runner.resumedNote",
      "quiz.runner.notFound",
      "quiz.cap99Note",
      "quiz.retakeNote",
      "quiz.backToPlan",
    ];
    for (const key of required) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en ${key}`).toBeTruthy();
    }
  });
});
