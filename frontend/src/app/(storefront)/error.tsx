"use client";
import { useI18n } from "@/components/i18n-provider";

import { Flower2, RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main-content" className="error-page">
      <Flower2 size={42} strokeWidth={1} />
      <h1>{t("A little pause.")}</h1>
      <p>
        {t(
          "We couldn’t reach the collection right now. Please try again in a moment.",
        )}
      </p>
      <button className="button" onClick={reset}>
        {t("Try again")} <RefreshCw size={16} />
      </button>
    </main>
  );
}
