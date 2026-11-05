import React, { createContext, useContext, useState, useCallback } from "react";
import { DEFAULT_PROGRESS, DEFAULT_MASTERY, type MasteryTopic } from "@/lib/demo-data";

export type Mastery = Record<MasteryTopic, number>;

export interface MasteryDelta {
  topic: MasteryTopic;
  from: number;
  to: number;
}

interface UserProgress {
  points: number;
  streak: number;
  level: number;
  quizzesCompleted: number;
  flashcardsReviewed: number;
  studyMinutes: number;
  correctAnswers: number;
  totalAnswers: number;
  weeklyGoal: number;
  weeklyProgress: number;
}

interface UserProgressContextType {
  progress: UserProgress;
  mastery: Mastery;
  /** Increments on resetAll — pages with local demo state (Planner tasks) reset when it changes. */
  resetTick: number;
  /** Record a finished quiz: evidence counters + weekly session + mastery deltas (evidence-only, FR-3/20). */
  applyQuizOutcome: (opts: { correct: number; total: number; deltas: MasteryDelta[] }) => void;
  reviewFlashcard: () => void;
  resetAll: () => void;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

function freshState(): { progress: UserProgress; mastery: Mastery } {
  return {
    progress: { ...DEFAULT_PROGRESS, weeklyProgress: DEFAULT_PROGRESS.weeklyProgress },
    mastery: { ...DEFAULT_MASTERY },
  };
}

export function UserProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress>(() => freshState().progress);
  const [mastery, setMastery] = useState<Mastery>(() => freshState().mastery);
  // The demo planner's tasks left with /planner's todayHub re-point (epic
  // P2-09 T3); resetAll is observed via this counter (Settings' probe).
  const [resetTick, setResetTick] = useState(0);

  const applyQuizOutcome = useCallback((opts: { correct: number; total: number; deltas: MasteryDelta[] }) => {
    setProgress(p => ({
      ...p,
      quizzesCompleted: p.quizzesCompleted + 1,
      correctAnswers: p.correctAnswers + opts.correct,
      totalAnswers: p.totalAnswers + opts.total,
      studyMinutes: p.studyMinutes + 8,
      weeklyProgress: Math.min(p.weeklyGoal, p.weeklyProgress + 1),
    }));
    setMastery(m => {
      const next = { ...m };
      opts.deltas.forEach(d => { next[d.topic] = d.to; });
      return next;
    });
  }, []);

  const reviewFlashcard = useCallback(() => {
    setProgress(p => ({ ...p, flashcardsReviewed: p.flashcardsReviewed + 1 }));
  }, []);

  const resetAll = useCallback(() => {
    const fresh = freshState();
    setProgress(fresh.progress);
    setMastery(fresh.mastery);
    setResetTick(t => t + 1);
  }, []);

  return (
    <UserProgressContext.Provider value={{ progress, mastery, resetTick, applyQuizOutcome, reviewFlashcard, resetAll }}>
      {children}
    </UserProgressContext.Provider>
  );
}

export function useUserProgress() {
  const ctx = useContext(UserProgressContext);
  if (!ctx) throw new Error("useUserProgress must be used within UserProgressProvider");
  return ctx;
}
