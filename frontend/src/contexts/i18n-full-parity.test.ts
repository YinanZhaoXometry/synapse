/**
 * i18n dictionary — FULL zh/en parity (epic P3-17 ticket 04): the whole
 * translations table must have identical key sets in both languages with
 * non-empty copy on every key. The four namespace-scoped parity walks
 * (tasks.*, the T5 namespaces, quiz/flashcards) predate this and stay as
 * documentation of when each was added; this walk closes what they couldn't —
 * a one-sided key under dashboard.*, reader.*, planner.*, hub.* or anywhere
 * else now fails here instead of surfacing as raw key text in one language.
 */
import { describe, expect, it } from "vitest";
import { translations } from "./i18n-dictionary";

describe("i18n dictionary — full zh/en parity", () => {
  it("zh and en carry the exact same key sets, both directions", () => {
    const zh = Object.keys(translations.zh);
    const en = Object.keys(translations.en);

    // Anti-vacuity: the walk must actually be looking at the whole table —
    // a structural accident that emptied either side would otherwise pass
    // the set equality below with two empty arrays. The dictionary is
    // hundreds of keys; 300 is a floor far under the real count, not a cap.
    expect(zh.length).toBeGreaterThanOrEqual(300);
    expect(en.length).toBeGreaterThanOrEqual(300);

    expect(zh.filter((key) => !(key in translations.en)), "keys missing from en").toEqual([]);
    expect(en.filter((key) => !(key in translations.zh)), "keys missing from zh").toEqual([]);
  });

  it("every key has non-empty copy in BOTH languages", () => {
    for (const key of Object.keys(translations.zh)) {
      expect(translations.zh[key as keyof typeof translations.zh], `zh copy for ${key}`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `en copy for ${key}`).toBeTruthy();
    }
  });
});
