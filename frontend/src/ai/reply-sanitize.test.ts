import { describe, expect, it } from "vitest";
import { sanitizeCompanionReplyText } from "./reply-sanitize";

// The companion-reply unwrap backstop (2026-11-06): the prompts forbid JSON,
// and a {"hint": …} answer must never render as the tutor's message. The
// sanitizer is conservative — full-reply JSON objects only.
describe("sanitizeCompanionReplyText", () => {
  it("passes prose through untouched (the common case, byte-honest)", () => {
    const prose = "先往这个方向想：这一页谈到 Raft 的选举超时。它为什么成立？";
    expect(sanitizeCompanionReplyText(prose)).toBe(prose);
  });

  it("unwraps a bare JSON object's hint field (the reported shape)", () => {
    expect(sanitizeCompanionReplyText('{"hint": "这个 Legacy 学习计划的内容可以在 Phase-1 本地文档中找到。"}')).toBe(
      "这个 Legacy 学习计划的内容可以在 Phase-1 本地文档中找到。",
    );
  });

  it("unwraps a fenced JSON object and prefers the known keys", () => {
    const fenced = "```json\n{\"explanation\": \"ignored — not preferred\", \"answer\": \"Raft 用心跳超时检测 leader 失联。\"}\n```";
    expect(sanitizeCompanionReplyText(fenced)).toBe("Raft 用心跳超时检测 leader 失联。");
  });

  it("falls back to the first string value when no preferred key matches", () => {
    expect(sanitizeCompanionReplyText('{"zh": "提示内容", "meta": 3}')).toBe("提示内容");
  });

  it("leaves non-unwrapable shapes alone", () => {
    expect(sanitizeCompanionReplyText('["not", "an", "object"]')).toBe('["not", "an", "object"]');
    expect(sanitizeCompanionReplyText('{"hint": {"nested": "object — no string field"}}')).toBe(
      '{"hint": {"nested": "object — no string field"}}',
    );
    expect(sanitizeCompanionReplyText('{"hint": ""}')).toBe('{"hint": ""}'); // empty field — nothing honest to surface
    expect(sanitizeCompanionReplyText("总成本 = {a} + {b}，大括号不是 JSON。")).toBe(
      "总成本 = {a} + {b}，大括号不是 JSON。",
    );
    expect(sanitizeCompanionReplyText("")).toBe("");
  });
});
