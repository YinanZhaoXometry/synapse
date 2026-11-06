import { describe, expect, it } from "vitest";
import {
  formatQuizFence,
  isValidCompanionQuiz,
  leadBeforeQuiz,
  splitQuizBlock,
  QUIZ_FENCE_MARKER,
  type CompanionQuiz,
} from "./quiz";

/**
 * The companion quiz-block contract (epic-24 T4): the fence parser is the
 * ONE place the reply text becomes an interactive question — full-fence-or-
 * nothing (malformed never renders as a fake block), structural validation
 * on both forms, and the streaming slice never leaks the payload.
 */
describe("splitQuizBlock (epic-24 T4)", () => {
  const choice: CompanionQuiz = {
    kind: "choice",
    question: "____ 是分布式一致性算法。",
    options: ["Raft", "HTTP", "CSS", "FTP"],
    answer: 0,
    explanation: "出自材料第二段。",
  };

  it("a valid choice fence splits into lead + quiz", () => {
    const text = `先来一题：\n\n${formatQuizFence(choice)}`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(lead).toBe("先来一题：");
    expect(quiz).toEqual(choice);
  });

  it("a valid short fence parses with keywords + answerText", () => {
    const short: CompanionQuiz = {
      kind: "short",
      question: "解释 Raft 的领导者选举。",
      answerText: "Raft 通过任期与多数投票选出领导者。",
      keywords: ["任期", "投票"],
      explanation: "对照材料原文。",
    };
    const { quiz } = splitQuizBlock(`考你一下\n${formatQuizFence(short)}`);
    expect(quiz).toEqual(short);
  });

  it("no fence — text intact, quiz null", () => {
    const { lead, quiz } = splitQuizBlock("plain companion prose");
    expect(lead).toBe("plain companion prose");
    expect(quiz).toBeNull();
  });

  it("malformed JSON degrades honestly: the WHOLE text renders, never a fake block", () => {
    const text = `${QUIZ_FENCE_MARKER}\n{"kind":"choice","question": no json}\n\`\`\``;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toBeNull();
    expect(lead).toBe(text);
  });

  it("an unterminated fence (mid-stream snapshot) is not a block", () => {
    const text = `lead\n${QUIZ_FENCE_MARKER}\n{"kind":"choice"`;
    const { quiz } = splitQuizBlock(text);
    expect(quiz).toBeNull();
  });

  it.each([
    ["out-of-range answer index", { kind: "choice", question: "q?", options: ["a", "b"], answer: 5 }],
    ["non-integer answer", { kind: "choice", question: "q?", options: ["a", "b"], answer: 1.5 }],
    ["empty option", { kind: "choice", question: "q?", options: ["a", "  "], answer: 0 }],
    ["single option", { kind: "choice", question: "q?", options: ["a"], answer: 0 }],
    ["short without answerText", { kind: "short", question: "q?" }],
    ["empty question", { kind: "choice", question: "  ", options: ["a", "b"], answer: 0 }],
    ["unknown kind", { kind: "cloze", question: "q?" }],
  ])("invalid payload (%s) is rejected — the raw text renders", (_label, payload) => {
    expect(isValidCompanionQuiz(payload)).toBe(false);
    const text = `lead\n${formatQuizFence(payload as never)}`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toBeNull();
    expect(lead).toBe(text);
  });
});

describe("leadBeforeQuiz (the streaming slice)", () => {
  it("hides everything from the marker on — the JSON never flashes into the bubble", () => {
    expect(leadBeforeQuiz(`好的，出题：\n${QUIZ_FENCE_MARKER}\n{"kind"`)).toBe("好的，出题：");
  });

  it("no marker — the text passes through untouched", () => {
    expect(leadBeforeQuiz("still streaming prose")).toBe("still streaming prose");
  });
});
