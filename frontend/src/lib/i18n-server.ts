import "server-only";
import { cookies } from "next/headers";
import { languageCookie, normalizeLanguage, translate } from "./i18n";

export async function getLanguage() {
  return normalizeLanguage((await cookies()).get(languageCookie)?.value);
}
export async function getTranslator() {
  const language = await getLanguage();
  return (source: string, ...values: (string | number)[]) =>
    translate(language, source, ...values);
}
