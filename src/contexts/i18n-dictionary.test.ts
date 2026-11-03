/**
 * i18n dictionary parity — the tasks.* namespace (epic-5 T4 sweep, AD-9):
 * every tasks.* key present in one language table must exist in the other,
 * with non-empty copy on both sides. Scoped to tasks.* because that is the
 * namespace epic-5 added; the walk makes the sweep durable — a future key
 * added to only one language fails here instead of surfacing as raw key text
 * in the UI.
 */
import { describe, expect, it } from "vitest";
import { translations } from "./i18n-dictionary";

type Lang = keyof typeof translations;

function tasksKeys(lang: Lang): string[] {
  return Object.keys(translations[lang]).filter((key) => key.startsWith("tasks."));
}

describe("i18n dictionary — tasks.* zh/en parity (AD-9)", () => {
  it("every tasks.* key exists in BOTH languages with non-empty copy", () => {
    const zh = tasksKeys("zh");
    const en = tasksKeys("en");

    expect(zh.length).toBeGreaterThan(0); // the namespace exists at all
    // set equality, both directions, with the missing keys named
    expect(zh.filter((key) => !en.includes(key))).toEqual([]);
    expect(en.filter((key) => !zh.includes(key))).toEqual([]);

    for (const key of zh) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });
});
