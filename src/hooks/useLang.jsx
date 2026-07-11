import { createContext, useContext, useState, useEffect } from "react";
import { t } from "../lib/i18n";

const LangContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem("hsd-lang");
      if (saved) return saved;
      const bl = (navigator.language || "").toLowerCase();
      if (bl.startsWith("ja")) return "jp";
    } catch {}
    return "en";
  });

  function setLang(l) {
    setLangState(l);
    try { localStorage.setItem("hsd-lang", l); } catch {}
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: (key) => t(lang, key) }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
