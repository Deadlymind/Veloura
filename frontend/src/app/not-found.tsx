import { getTranslator } from "@/lib/i18n-server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
export default async function NotFound() {
  const t = await getTranslator();
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">{t("A NEW DIRECTION")}</p>
      <h1>{t("This little beauty has moved.")}</h1>
      <p>
        {t(
          "We couldn’t find that product or collection. There’s still plenty to explore.",
        )}
      </p>
      <Link href="/category/all" className="button">
        {t("Explore the collection")} <ArrowRight size={16} />
      </Link>
    </main>
  );
}
