"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n-provider";
import { languageCookie, normalizeLanguage } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { language } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="language-switcher">
      <span className="sr-only">
        {language === "fr" ? "Langue" : "Language"}
      </span>
      <select
        value={language}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => {
          const next = normalizeLanguage(event.target.value);
          document.cookie = `${languageCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
          startTransition(() => router.refresh());
        }}
      >
        <option value="en" lang="en">
          EN
        </option>
        <option value="fr" lang="fr">
          FR
        </option>
      </select>
    </label>
  );
}
