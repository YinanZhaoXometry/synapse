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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("synapse-lang");
    return (saved === "en" || saved === "zh") ? saved : "zh";
  });

  const setLanguage = useCallback((lang: Language) => {
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
