import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { createQuizSession, getQuizSession, listEvidence, loadDb, registerMaterial } from "@/data";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { MaterialSection } from "@/domain/entities";
import { useQuizSession } from "./use-quiz-session";

/**
 * Epic-6 T1 driver tests: the evidence loop walked through the REAL
 * production seams — useQuizSession → simulated Companion (generateQuiz /
 * gradeOpenAnswer) → quiz repository over real localStorage → the atomic
 * recordEvidence batch (evidence + auto-mistakes + session completion).
 * Headless, nothing rendered (prior art: quiz-repository.test.ts and the
 * task-loop integration walk). The simulated 600ms delays are awaited with
 * real timers — the same trade the integration walks make.
 *
 * Generator contract used for answering: a choice question's correct option is
 * its own section title (distractors are other sections' titles), and an open
 * answer naming one keyword fragment grades partial (≥2 hits correct, 1
 * partial, 0 wrong — the seam's spec rule).
 */

const sections: MaterialSection[] = [
  { id: "sec-1", title: "集成测试", text: "集成测试关注组件之间的交互。接口契约必须先验证。" },
  { id: "sec-2", title: "需求工程", text: "需求工程把用户需要转化为规约。验收标准来自规约。" },
];

function seedMaterial() {
  return registerMaterial({
    title: "复习讲义.md",
    kind: "markdown",
    sizeBytes: 64,
    planId: null,
    taskId: null,
    sections,
    parseState: "parsed",
  }).material;
}

/** Wrapper owns one QueryClient for the hook's lifetime, under the same
 * LanguageProvider the app mounts (gradeOpenAnswer reads the language). */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </LanguageProvider>
    );
  };
}

const startInput = (materialId: string, mode: "open" | "choice" | "mix", scoped = sections) => ({
  materials: [{ materialId, sections: scoped }],
  nodeIds: ["node-1"],
  mode,
  planId: null,
  taskId: null,
});

/** The simulated grading wait + the driver's seam round-trip (real timers). */
async function flushGrading() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 750));
  });
}

/** React Query runs mutation functions on a tick — flush a couple of
 * macrotasks so the repository writes have landed before asserting. */
async function flushWrites() {
  for (let i = 0; i < 2; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Select the correct (title) option of the active choice question. */
function selectTitle(result: { current: ReturnType<typeof useQuizSession> }, title: string) {
  const view = result.current.run?.views[result.current.run.currentIndex];
  act(() => result.current.select(view?.options.indexOf(title) ?? -1));
  act(() => result.current.submit());
}

beforeEach(() => {
  localStorage.clear();
});

describe("useQuizSession — the evidence loop through the driver (FR-18; AD-5/6)", () => {
  it("a choice run completes atomically: exactly one EvidenceRecord per answer, node-attributed, session completed", async () => {
    const material = seedMaterial();
    const { result } = renderHook(() => useQuizSession(), { wrapper: makeWrapper() });
    expect(result.current.phase).toBe("idle");

    await act(async () => {
      await result.current.start(startInput(material.id, "choice", [sections[0]])); // scoped to one section
    });
    expect(result.current.phase).toBe("active");
    const run = result.current.run;
    expect(run?.status).toBe("running");
    expect(run?.views).toHaveLength(1); // one section, choice mode → one question (the mix test walks interleaved kinds)
    // attempt gate holds on the driver's output too — no answer fields on the view
    const view = run?.views[0];
    expect(view?.status).toBe("answering");
    expect(view && "correctOptionIndex" in view).toBe(false);
    expect(view && "explanation" in view).toBe(false);

    act(() => result.current.select(view?.options.indexOf("集成测试") ?? -1)); // the title = correct option
    act(() => result.current.submit());

    expect(result.current.phase).toBe("completed");
    expect(result.current.results?.map((r) => r.outcome)).toEqual(["correct"]);
    expect(result.current.results?.[0]?.outcomeValue).toBe(1);
    await flushWrites(); // the evidence mutation lands on a tick

    // the atomic landing: one evidence record (recordEvidence fired EXACTLY once —
    // a double batch would make this two), node attribution from the question (AD-6)
    const evidence = listEvidence();
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.outcome).toBe("correct");
    expect(evidence[0]?.nodeId).toBe("node-1");
    expect(evidence[0]?.sessionId).toBe(run?.sessionId);
    expect(getQuizSession(run?.sessionId ?? "")?.status).toBe("completed");
    expect(loadDb().mistakes).toHaveLength(0); // nothing wrong — no mistakes
  });

  it("a mix run interleaves kinds; the open answer grades through the AI seam with rationale + citation carried", async () => {
    const material = seedMaterial();
    const { result } = renderHook(() => useQuizSession(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start(startInput(material.id, "mix"));
    });
    // interleaved as generated: choice+open per section, generator order
    expect(result.current.run?.views.map((v) => v.kind)).toEqual(["choice", "open", "choice", "open"]);

    selectTitle(result, "集成测试"); // q1 choice → correct, auto-advance
    expect(result.current.run?.views[1]?.status).toBe("answering");

    act(() => result.current.typeAnswer("集成")); // ONE keyword hit → partial
    act(() => result.current.submit());
    expect(result.current.grading).toBe(true); // the 「对照材料评分中」 wait
    expect(result.current.phase).toBe("active");
    expect(result.current.results).toBeNull(); // nothing lands mid-run

    await flushGrading();

    expect(result.current.grading).toBe(false);
    expect(result.current.run?.views[1]?.status).toBe("graded");
    selectTitle(result, "需求工程"); // q3 choice
    act(() => result.current.typeAnswer("需求")); // partial again
    act(() => result.current.submit());
    await flushGrading();

    expect(result.current.phase).toBe("completed");
    const results = result.current.results;
    expect(results?.map((r) => r.outcome)).toEqual(["correct", "partial", "correct", "partial"]);
    expect(results?.map((r) => r.outcomeValue)).toEqual([1, 0.5, 1, 0.5]); // ADR-0001 mapping
    expect(results?.[1]?.grading?.rationale).toContain("集成"); // the seam's rationale carried for the UI
    expect(results?.[1]?.grading?.citation?.locator).toEqual({ kind: "markdown", sectionId: "sec-1" });
    expect(results?.[3]?.grading?.citation?.locator).toEqual({ kind: "markdown", sectionId: "sec-2" });

    const evidence = listEvidence();
    expect(evidence).toHaveLength(4);
    expect(evidence.map((e) => e.outcome)).toEqual(["correct", "partial", "correct", "partial"]);
    expect(evidence.every((e) => e.nodeId === "node-1")).toBe(true); // AD-6 attribution across the whole batch
    expect(loadDb().mistakes).toHaveLength(0); // partial ≠ wrong — no mistakes
    expect(getQuizSession(result.current.run?.sessionId ?? "")?.status).toBe("completed");
  });

  it("wrong + forfeit answers land wrong evidence and auto-log MistakeEntries with the forfeit flag", async () => {
    const material = seedMaterial();
    const { result } = renderHook(() => useQuizSession(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.start(startInput(material.id, "choice"));
    });

    // q1: select the OTHER section's title — a real distractor → wrong on submit
    act(() => result.current.select(result.current.run?.views[0]?.options.indexOf("需求工程") ?? -1));
    act(() => result.current.submit());
    expect(result.current.run?.views[0]).toMatchObject({ status: "submitted", outcome: "wrong" });

    // q2: forfeit without selecting → 「看答案」, revealed as wrong
    act(() => result.current.forfeit());
    await flushWrites(); // the evidence mutation lands on a tick

    expect(result.current.phase).toBe("completed");
    expect(result.current.results?.map((r) => r.outcome)).toEqual(["wrong", "wrong"]);
    expect(result.current.results?.map((r) => r.forfeited)).toEqual([false, true]);
    expect(result.current.results?.map((r) => r.outcomeValue)).toEqual([0, 0]); // ADR-0001: forfeit = wrong = 0

    const db = loadDb();
    expect(listEvidence().map((e) => e.outcome)).toEqual(["wrong", "wrong"]);
    expect(db.mistakes).toHaveLength(2);
    expect(db.mistakes.map((m) => m.forfeited)).toEqual([false, true]);
    expect(db.mistakes.map((m) => m.userAnswer)).toEqual(["需求工程", ""]);
    expect(db.mistakes.every((m) => m.nodeId === "node-1")).toBe(true);
    expect(db.mistakes[0]?.sourceLocation).toEqual({ kind: "markdown", sectionId: "sec-1" });
    expect(db.mistakes[1]?.sourceLocation).toEqual({ kind: "markdown", sectionId: "sec-2" });
  });

  it("abandon persists the terminal status, records NO evidence, and is not resumable", async () => {
    const material = seedMaterial();
    const { result } = renderHook(() => useQuizSession(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.start(startInput(material.id, "choice"));
    });
    const sessionId = result.current.run?.sessionId ?? "";

    act(() => result.current.abandon());
    await flushWrites(); // the abandon mutation lands on a tick

    expect(result.current.phase).toBe("abandoned");
    expect(result.current.results).toBeNull(); // an abandoned run produces nothing
    expect(getQuizSession(sessionId)?.status).toBe("abandoned");
    expect(getQuizSession(sessionId)?.completedAt).toBeNull();
    expect(listEvidence()).toHaveLength(0);
    expect(loadDb().mistakes).toHaveLength(0);

    // abandoned is NOT resumable (the machine refuses; the driver reports false)
    let resumed = true;
    act(() => {
      resumed = result.current.hydrate(sessionId);
    });
    expect(resumed).toBe(false);
    expect(result.current.phase).toBe("abandoned");
  });

  it("hydrate revives an ACTIVE repository session; completing it lands evidence for that session", async () => {
    // a session created the T2 way — already persisted, never started in this hook
    const { session } = createQuizSession({
      planId: null,
      taskId: null,
      mode: "choice",
      questions: [
        {
          prompt: "Choice one",
          nodeId: "node-h",
          kind: "choice",
          options: ["right", "wrong"],
          correctOptionIndex: 0,
          sourceMaterialId: "m-any",
          sourceSectionId: "sec-1",
          explanation: "because",
        },
        {
          prompt: "Choice two",
          nodeId: "node-h",
          kind: "choice",
          options: ["wrong", "right"],
          correctOptionIndex: 1,
          sourceMaterialId: "m-any",
          sourceSectionId: "sec-1",
          explanation: "because",
        },
      ],
    });
    expect(getQuizSession(session.id)?.status).toBe("active");

    const { result } = renderHook(() => useQuizSession(), { wrapper: makeWrapper() });
    let revived = false;
    act(() => {
      revived = result.current.hydrate(session.id);
    });
    expect(revived).toBe(true);
    expect(result.current.phase).toBe("active");
    expect(result.current.run?.sessionId).toBe(session.id);
    expect(result.current.run?.views.map((v) => v.status)).toEqual(["answering", "pending"]);

    // play the resumed run through to completion
    act(() => result.current.select(0));
    act(() => result.current.submit());
    act(() => result.current.select(1));
    act(() => result.current.submit());
    await flushWrites(); // the evidence mutation lands on a tick

    expect(result.current.phase).toBe("completed");
    const evidence = listEvidence();
    expect(evidence).toHaveLength(2);
    expect(evidence.every((e) => e.sessionId === session.id)).toBe(true);
    expect(evidence.every((e) => e.nodeId === "node-h")).toBe(true);
    expect(getQuizSession(session.id)?.status).toBe("completed");

    // a completed session is terminal — hydrate refuses it
    expect(result.current.hydrate(session.id)).toBe(false);
  });
});
