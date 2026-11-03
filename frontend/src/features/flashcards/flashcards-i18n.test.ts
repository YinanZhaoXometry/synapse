/**
 * i18n dictionary parity — the flashcards.* plan-flow additions (epic-6 T3,
 * AD-9; the quiz.* precedent): every flashcards.* key present in one language
 * table must exist in the other, with non-empty copy on both sides. A future
 * key added to only one language fails here instead of surfacing as raw key
 * text in the flashcard surfaces.
 */
import { describe, expect, it } from "vitest";
import { translations } from "@/contexts/i18n-dictionary";

type Lang = keyof typeof translations;

function flashcardKeys(lang: Lang): string[] {
  return Object.keys(translations[lang]).filter((key) => key.startsWith("flashcards."));
}

describe("i18n dictionary — flashcards.* zh/en parity (AD-9)", () => {
  it("every flashcards.* key exists in BOTH languages with non-empty copy", () => {
    const zh = flashcardKeys("zh");
    const en = flashcardKeys("en");

    expect(zh.length).toBeGreaterThan(0); // the namespace exists at all
    // set equality, both directions, with the missing keys named
    expect(zh.filter((key) => !en.includes(key))).toEqual([]);
    expect(en.filter((key) => !zh.includes(key))).toEqual([]);

    for (const key of zh) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("the T3 plan-flow additions are present (launcher/study/summary vocabulary)", () => {
    const required = [
      "flashcards.launcher.title",
      "flashcards.launcher.generating",
      "flashcards.launcher.needMaterial",
      "flashcards.study.frontLabel",
      "flashcards.study.keyboardHint",
      "flashcards.summary.breakdown",
      "flashcards.summary.statelessNote",
      "flashcards.tileContinue",
    ];
    for (const key of required) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en ${key}`).toBeTruthy();
    }
  });
});
