import { describe, expect, it } from "vitest";
import {
  formatQuizFence,
  isValidCompanionQuiz,
  leadBeforeQuiz,
  quizTailArrived,
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

  it("an unterminated fence whose JSON is COMPLETE is salvaged (drift: the close never arrived)", () => {
    const text = `先来一题：\n${QUIZ_FENCE_MARKER}\n${JSON.stringify(choice)}`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toEqual(choice);
    expect(lead).toBe("先来一题：");
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

  it("a bare drift payload hides from its first character on (owner bug round 2026-11-10)", () => {
    const partial = '先来一题：\n\n{"kind":"choice","question":"尚';
    expect(leadBeforeQuiz(partial)).toBe("先来一题：");
    expect(quizTailArrived(partial)).toBe(true);
  });
});

describe("the bare-JSON drift salvage (owner bug round 2026-11-10)", () => {
  const choice: CompanionQuiz = {
    kind: "choice",
    question: "____ 是分布式一致性算法。",
    options: ["Raft", "HTTP", "CSS", "FTP"],
    answer: 0,
    explanation: "出自材料第二段。",
  };

  it("a bare payload riding the reply tail becomes the block — no fence involved", () => {
    const text = `先来一题：\n\n${JSON.stringify(choice)}`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toEqual(choice);
    expect(lead).toBe("先来一题：");
  });

  it("spacing drift around the colon is tolerated", () => {
    const text = `考你一下 { "kind" : "choice" , "question":"q","options":["a","b"],"answer":0 }`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz?.question).toBe("q");
    expect(lead).toBe("考你一下");
  });

  it("a plain ```json wrap (fence-tag drift) still becomes the block", () => {
    const text = `先来一题：\n\n\`\`\`json\n${JSON.stringify(choice)}\n\`\`\``;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toEqual(choice);
    expect(lead).toBe("先来一题：");
  });

  it("prose AFTER the payload rejoins the lead — model words are never hidden", () => {
    const text = `题目来了\n\n${JSON.stringify(choice)}\n\n祝你顺利！`;
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toEqual(choice);
    expect(lead).toContain("题目来了");
    expect(lead).toContain("祝你顺利！");
  });

  it("the LAST usable payload wins when prose quotes the shape earlier", () => {
    const text = `格式是 {"kind":"choice","question":"示例"} 这样\n\n${JSON.stringify(choice)}`;
    const { quiz } = splitQuizBlock(text);
    expect(quiz).toEqual(choice);
  });

  it("a bare NON-quiz JSON stays honest prose — never a fake block", () => {
    const text = '数据形如 {"kind":"choice","question":"只有两个键"}';
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toBeNull();
    expect(lead).toBe(text);
  });

  it("a bare INVALID payload (bad index) stays honest prose", () => {
    const invalid = { ...choice, answer: 9 };
    const text = JSON.stringify(invalid);
    const { lead, quiz } = splitQuizBlock(text);
    expect(quiz).toBeNull();
    expect(lead).toBe(text);
  });
});

describe("quizTailArrived (the streaming pending signal)", () => {
  it("true for the fence marker", () => {
    expect(quizTailArrived(`lead\n${QUIZ_FENCE_MARKER}`)).toBe(true);
  });

  it("true for a bare drift payload, even partially arrived", () => {
    expect(quizTailArrived('{"kind":"short","answ')).toBe(true);
    expect(quizTailArrived('{"kind" : "choice", "q')).toBe(true);
  });

  it("false for plain streaming prose", () => {
    expect(quizTailArrived("还在生成正文")).toBe(false);
    expect(quizTailArrived('格式示例 {"kind":"quiz"} 不是考点')).toBe(false);
  });
});
