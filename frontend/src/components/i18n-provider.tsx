"use client";
import { createContext, useContext, useMemo } from "react";
import { Language, translate } from "@/lib/i18n";

const Context = createContext<Language>("en");
export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return <Context.Provider value={language}>{children}</Context.Provider>;
}
export function useI18n() {
  const language = useContext(Context);
  return useMemo(
    () => ({
      language,
      locale: language === "fr" ? "fr-FR" : "en-US",
      t: (source: string, ...values: (string | number)[]) =>
        translate(language, source, ...values),
    }),
    [language],
  );
}
