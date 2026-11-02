/**
 * PROTOTYPE scene 5/8 — quiz, final state: materials-sourced questions with
 * provenance chips, mixed modes (choice + open), and the evidence loop made
 * visible: grading records EvidenceRecords through the REAL mastery functions
 * and shows each node's score before → after, plus the plan rollup delta.
 * Retaking appends more evidence — exactly like the shipped domain model.
 */
import { useState } from "react";
import { CheckCircle2, FileText, Gauge, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useL, demoNodes, demoQuestions, gradeOpenAnswer, type DemoQuestion, type ProtoState } from "./demo";
import { computeNodeScore, computePlanRollup } from "@/domain/mastery";
import { OutcomeMark } from "@/features/plans/atoms";

type Outcome = "correct" | "partial" | "wrong";

interface Graded {
  perQuestion: { outcome: Outcome; pick: string }[];
  /** node id → score computed from evidence BEFORE this submission */
  beforeByNode: Record<string, number>;
  rollupBefore: number;
}

export default function SceneQuiz({ state }: { state: ProtoState }) {
  const l = useL();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<Graded | null>(null);

  const submit = () => {
    if (graded) return;
    const perQuestion = demoQuestions.map((q) => {
      const pick = answers[q.id] ?? "";
      if (q.kind === "choice") return { q, outcome: (Number(pick) === q.correctOptionIndex ? "correct" : "wrong") as Outcome, pick };
      return { q, outcome: gradeOpenAnswer(pick, q.keywords ?? []), pick };
    });

    // snapshot "before" from the pre-submit evidence, then append new records
    const beforeByNode: Record<string, number> = {};
    for (const { q } of perQuestion) {
      beforeByNode[q.nodeId] = computeNodeScore(state.evidence.filter((e) => e.nodeId === q.nodeId));
    }
    const rollupBefore = computePlanRollup(basisForPlan(state.evidence));

    const now = new Date().toISOString();
    state.addEvidence(
      perQuestion.map(({ q, outcome }, i) => ({
        id: `ev-proto-${now}-${i}`,
        nodeId: q.nodeId,
        sessionId: `s-proto-${now}`,
        questionId: q.id,
        outcome,
        createdAt: now,
      })),
    );
    setGraded({ perQuestion: perQuestion.map(({ outcome, pick }) => ({ outcome, pick })), beforeByNode, rollupBefore });
  };

  const reset = () => {
    setAnswers({});
    setGraded(null);
  };

  const allAnswered = demoQuestions.every((q) => (answers[q.id] ?? "") !== "");
  const rollupAfter = graded ? computePlanRollup(basisForPlan(state.evidence)) : 0;

  return (
    <div className="p-6 md:p-8 max-w-[760px] mx-auto animate-fade-in pb-24">
      <p className="eyebrow">
        {l("小测", "Quiz")} · {l("混合模式", "Mixed")}
      </p>
      <h1 className="page-title mt-1.5">{l("监督学习 · 模型评估", "Supervised learning · Evaluation")}</h1>
      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
        <FileText className="w-3 h-3" aria-hidden="true" />
        {l("题目全部来自你的资料：《机器学习实战》第 3、12 页", "Sourced entirely from your materials: ML in Action p.3, p.12")}
      </p>

      <div className="mt-5 space-y-4">
        {demoQuestions.map((q, qi) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={qi + 1}
            pick={answers[q.id] ?? ""}
            onPick={(v) => !graded && setAnswers((a) => ({ ...a, [q.id]: v }))}
            graded={graded ? graded.perQuestion[qi] : null}
          />
        ))}
      </div>

      {!graded ? (
        <div className="flex items-center gap-3 mt-5">
          <Button onClick={submit} disabled={!allAnswered}>
            {l("交卷", "Submit")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {demoQuestions.filter((q) => (answers[q.id] ?? "") !== "").length}/{demoQuestions.length} {l("已作答", "answered")}
          </span>
        </div>
      ) : (
        <GradedPanel graded={graded} rollupAfter={rollupAfter} onRetake={reset} state={state} />
      )}
    </div>
  );
}

/** The p-ml plan's nodes seeded (uncovered = 0) for the shipped rollup. */
function basisForPlan(evidence: ProtoState["evidence"]) {
  const nodes = demoNodes.filter((n) => n.planId === "p-ml");
  const byNode: Record<string, ProtoState["evidence"]> = {};
  for (const n of nodes) byNode[n.id] = [];
  for (const e of evidence) if (e.nodeId in byNode) byNode[e.nodeId].push(e);
  return byNode;
}

function QuestionCard({
  q,
  index,
  pick,
  onPick,
  graded,
}: {
  q: DemoQuestion;
  index: number;
  pick: string;
  onPick: (v: string) => void;
  graded: null | { outcome: Outcome; pick: string };
}) {
  const l = useL();
  return (
    <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-[1.6]">
          <span className="text-muted-foreground mr-1.5">{index}.</span>
          {q.prompt}
        </p>
        {graded && <OutcomeMark outcome={graded.outcome} />}
      </div>

      {q.kind === "choice" ? (
        <div className="mt-3 space-y-1.5">
          {q.options!.map((opt, oi) => {
            const picked = pick === String(oi);
            const correct = !!graded && oi === q.correctOptionIndex;
            const wrongPick = !!graded && picked && oi !== q.correctOptionIndex;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onPick(String(oi))}
                className={`w-full text-left text-[13px] rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                  correct
                    ? "border-[rgba(57,172,134,0.3)] bg-[var(--mastered-tint)]"
                    : wrongPick
                      ? "border-destructive/40 bg-[hsl(var(--destructive)/0.08)]"
                      : picked
                        ? "border-[var(--accent-ring)] bg-[var(--accent-tint)]"
                        : "border-border-soft hover:bg-[var(--glass-2)]"
                }`}
              >
                {opt}
                {correct && <CheckCircle2 className="w-4 h-4 text-[var(--mastered-ink)] flex-none" aria-hidden="true" />}
                {wrongPick && <XCircle className="w-4 h-4 text-destructive flex-none" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ) : (
        <Textarea
          value={pick}
          onChange={(e) => onPick(e.target.value)}
          disabled={!!graded}
          rows={3}
          placeholder={l("用自己的话写——关键词会被判分，但理解比背诵重要", "Answer in your own words — keywords are graded, understanding matters more")}
          className="mt-3 text-[13px]"
        />
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-soft">
        <span className="pill pill-muted">{q.nodeTitle}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--citation-ink)]">
          <FileText className="w-3 h-3" aria-hidden="true" /> {q.sourceLabel}
        </span>
      </div>

      {graded && (
        <div className="mt-3 rounded-xl bg-[var(--glass-2)] border border-border-soft px-3.5 py-2.5 text-[12px] leading-[1.65]">
          <p className="font-semibold mb-0.5">{l("解析", "Explanation")}</p>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function GradedPanel({
  graded,
  rollupAfter,
  onRetake,
  state,
}: {
  graded: Graded;
  rollupAfter: number;
  onRetake: () => void;
  state: ProtoState;
}) {
  const l = useL();
  const nodeIds = [...new Set(demoQuestions.map((q) => q.nodeId))];

  return (
    <div className="mt-5 rounded-2xl border border-[var(--accent-ring)] bg-[var(--accent-tint)] p-5">
      <p className="eyebrow">{l("证据已记录 · 掌握度已更新", "Evidence recorded · mastery updated")}</p>
      <div className="mt-3 space-y-2.5">
        {nodeIds.map((nodeId) => {
          const node = demoNodes.find((n) => n.id === nodeId)!;
          const lastOutcome = graded.perQuestion[demoQuestions.findIndex((q) => q.nodeId === nodeId)].outcome;
          const after = computeNodeScore(state.evidence.filter((e) => e.nodeId === nodeId));
          return (
            <div key={nodeId} className="flex items-center gap-3 text-sm">
              <OutcomeMark outcome={lastOutcome} />
              <span className="font-medium flex-1 truncate">{node.title}</span>
              <span className="tabular-nums text-xs text-muted-foreground">
                <b className="font-display text-foreground">{after}%</b>
                <span className="mx-1">←</span>
                {graded.beforeByNode[nodeId]}%
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-3 text-sm pt-2 border-t border-[var(--accent-ring)]">
          <Gauge className="w-4 h-4 text-accent-ink" aria-hidden="true" />
          <span className="font-medium flex-1">{l("计划总体掌握度", "Plan rollup")}</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            <b className="font-display text-foreground">{rollupAfter}%</b>
            <span className="mx-1">←</span>
            {graded.rollupBefore}%
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 leading-[1.6]">
        {l(
          "每次判分都是一条证据记录；节点分数 = 最近 5 条的均值，掌握还需 ≥3 条证据。回到「计划主页」或「总览」看数字落位。",
          "Each grade is an evidence record; node score = mean of last 5, mastery also needs ≥3 records. Visit Plan Home or Dashboard to see the numbers land.",
        )}
      </p>
      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" onClick={() => state.go("plan")}>
          {l("回计划主页看变化", "See it on Plan Home")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRetake}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> {l("再做一次（会追加证据）", "Retake (appends evidence)")}
        </Button>
      </div>
    </div>
  );
}
