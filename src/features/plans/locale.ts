/**
 * Locale-tag helper (review dedup): the one place deciding the BCP-47 tag for
 * `toLocaleDateString` — previously duplicated as a ternary in Plans Home and
 * Plan Home.
 */
import type { UiLanguage } from "@/ai/types";

export function localeTag(language: UiLanguage): "zh-CN" | "en-US" {
  return language === "zh" ? "zh-CN" : "en-US";
}
