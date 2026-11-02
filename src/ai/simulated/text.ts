/** Shared text helpers for the simulated adapter — one sentence-splitting implementation. */

export function firstSentence(text: string): string {
  return (text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [text])[0].trim();
}

export function splitSentences(text: string): string[] {
  return text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [];
}
