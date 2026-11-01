import React, { createContext, useContext, useState, useCallback } from "react";

type LearningMode = "ai" | "non-ai";

interface LearningModeContextType {
  mode: LearningMode;
  setMode: (mode: LearningMode) => void;
  isAI: boolean;
}

const LearningModeContext = createContext<LearningModeContextType | undefined>(undefined);

export function LearningModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<LearningMode>("ai");

  const setMode = useCallback((m: LearningMode) => setModeState(m), []);

  return (
    <LearningModeContext.Provider value={{ mode, setMode, isAI: mode === "ai" }}>
      {children}
    </LearningModeContext.Provider>
  );
}

export function useLearningMode() {
  const ctx = useContext(LearningModeContext);
  if (!ctx) throw new Error("useLearningMode must be used within LearningModeProvider");
  return ctx;
}
