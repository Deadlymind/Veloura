import fr from "./messages/fr.json";

export type Language = "en" | "fr";
export const languageCookie = "django_language";
export const normalizeLanguage = (value?: string | null): Language =>
  value === "fr" ? "fr" : "en";
export function translate(
  language: Language,
  source: string,
  ...values: (string | number)[]
) {
  const message =
    language === "fr"
      ? ((fr as Record<string, string>)[source] ?? source)
      : source;
  return message.replace(/\{(\d+)\}/g, (_, index) =>
    String(values[Number(index)] ?? `{${index}}`),
  );
}
export function clientTranslate(
  source: string,
  ...values: (string | number)[]
) {
  const language =
    typeof document === "undefined"
      ? "en"
      : normalizeLanguage(document.documentElement.lang);
  return translate(language, source, ...values);
}
