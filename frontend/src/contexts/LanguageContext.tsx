import { translations } from "./i18n-dictionary";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Language = "zh" | "en";

// The dictionary is nested by language: translations[lang][key] (prototype I18N shape).
type Dict = Record<string, string>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Non-React mirror (epic P2-8 T5): the AI server adapter (src/ai/
// companion-service-server.ts) generates quiz/flashcards in the UI's language
// but is not a component, so it cannot mount the hook. The provider keeps the
// mirror current (init + setLanguage); zh is the same fallback the provider
// initializes with, and the key is lazy-written so storage alone would lie.
let uiLanguageMirror: Language = "zh";

/** The UI's current language for non-React readers (the AI server adapter). */
export function currentUiLanguage(): Language {
  return uiLanguageMirror;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("synapse-lang");
    const resolved = (saved === "en" || saved === "zh") ? saved : "zh";
    uiLanguageMirror = resolved;
    return resolved;
  });

  const setLanguage = useCallback((lang: Language) => {
    uiLanguageMirror = lang;
    setLang(lang);
    localStorage.setItem("synapse-lang", lang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = (translations as Record<Language, Dict>)[language] ?? (translations as Record<Language, Dict>).zh;
    let text = dict[key] ?? (translations as Record<Language, Dict>).zh[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
