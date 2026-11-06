/**
 * Companion-reply unwrap (2026-11-06): the guardrailed prompts ask for
 * hint-first prose, but GLM occasionally answers a hint-first instruction
 * WITH a JSON object ({"hint": "…"}) — the learner then reads raw JSON as the
 * tutor's message. The prompts now forbid JSON explicitly; this sanitizer is
 * the render-side backstop for the generations that ignore it, applied where
 * the server adapter finalizes reply.text (both the material chat and the
 * plan chat — one seam, both surfaces).
 *
 * Conservative by design: only unwrap when the ENTIRE reply parses as a JSON
 * object (after stripping one wrapping code fence), and only surface a string
 * field — preferred keys first, then the first string value. Anything else
 * (arrays, prose with braces, fenced code the reply deliberately quotes)
 * passes through untouched.
 */

const PREFERRED_KEYS = ["hint", "answer", "text", "content", "reply", "message", "response", "explanation"];

/** Strip one wrapping markdown code fence: ```json\n…\n``` / ```\n…\n```. */
function stripWrappingFence(raw: string): string {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?\s*```$/.exec(raw.trim());
  return fenced ? fenced[1] : raw.trim();
}

function firstStringField(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  for (const key of PREFERRED_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function sanitizeCompanionReplyText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  try {
    const parsed = JSON.parse(stripWrappingFence(trimmed));
    const field = firstStringField(parsed);
    return field ?? trimmed;
  } catch {
    return trimmed;
  }
}
