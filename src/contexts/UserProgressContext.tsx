import React, { createContext, useContext, useState, useCallback } from "react";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
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
  achievements: Achievement[];
  weeklyGoal: number;
  weeklyProgress: number;
}

interface UserProgressContextType {
  progress: UserProgress;
  addPoints: (pts: number) => void;
  incrementStreak: () => void;
  addStudyMinutes: (mins: number) => void;
  recordAnswer: (correct: boolean) => void;
  completeQuiz: () => void;
  reviewFlashcard: () => void;
  unlockAchievement: (achievement: Omit<Achievement, "unlockedAt">) => void;
}

const defaultProgress: UserProgress = {
  points: 1250,
  streak: 7,
  level: 5,
  quizzesCompleted: 12,
  flashcardsReviewed: 84,
  studyMinutes: 340,
  correctAnswers: 89,
  totalAnswers: 108,
  achievements: [
    { id: "first-quiz", title: "测验新手", description: "完成第一次测验", icon: "🎯", unlockedAt: new Date("2025-03-14") },
    { id: "streak-3", title: "三天连续", description: "连续学习3天", icon: "🔥", unlockedAt: new Date("2025-03-16") },
    { id: "streak-7", title: "周冠军", description: "连续学习7天", icon: "⚡", unlockedAt: new Date("2025-03-20") },
    { id: "flashcard-50", title: "卡牌收集者", description: "复习50张闪卡", icon: "🃏", unlockedAt: new Date("2025-03-18") },
  ],
  weeklyGoal: 300,
  weeklyProgress: 210,
};

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

export function UserProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress>(defaultProgress);

  const addPoints = useCallback((pts: number) => {
    setProgress(p => {
      const newPoints = p.points + pts;
      const newLevel = Math.floor(newPoints / 500) + 1;
      return { ...p, points: newPoints, level: newLevel };
    });
  }, []);

  const incrementStreak = useCallback(() => {
    setProgress(p => ({ ...p, streak: p.streak + 1 }));
  }, []);

  const addStudyMinutes = useCallback((mins: number) => {
    setProgress(p => ({ ...p, studyMinutes: p.studyMinutes + mins, weeklyProgress: Math.min(p.weeklyProgress + mins, p.weeklyGoal) }));
  }, []);

  const recordAnswer = useCallback((correct: boolean) => {
    setProgress(p => ({
      ...p,
      correctAnswers: p.correctAnswers + (correct ? 1 : 0),
      totalAnswers: p.totalAnswers + 1,
    }));
  }, []);

  const completeQuiz = useCallback(() => {
    setProgress(p => ({ ...p, quizzesCompleted: p.quizzesCompleted + 1 }));
  }, []);

  const reviewFlashcard = useCallback(() => {
    setProgress(p => ({ ...p, flashcardsReviewed: p.flashcardsReviewed + 1 }));
  }, []);

  const unlockAchievement = useCallback((achievement: Omit<Achievement, "unlockedAt">) => {
    setProgress(p => {
      if (p.achievements.find(a => a.id === achievement.id)) return p;
      return { ...p, achievements: [...p.achievements, { ...achievement, unlockedAt: new Date() }] };
    });
  }, []);

  return (
    <UserProgressContext.Provider value={{ progress, addPoints, incrementStreak, addStudyMinutes, recordAnswer, completeQuiz, reviewFlashcard, unlockAchievement }}>
      {children}
    </UserProgressContext.Provider>
  );
}

export function useUserProgress() {
  const ctx = useContext(UserProgressContext);
  if (!ctx) throw new Error("useUserProgress must be used within UserProgressProvider");
  return ctx;
}
