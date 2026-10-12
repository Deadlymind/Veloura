import { getTranslator } from "@/lib/i18n-server";
export default async function Loading() {
  const t = await getTranslator();
  return (
    <main
      id="main-content"
      className="wrap loading-page"
      aria-busy="true"
      aria-label={t("Loading collection")}
    >
      <div className="skeleton h-5 w-32" />
      <div className="skeleton h-14 w-2/3 mt-6" />
      <div className="product-grid mt-12">
        {[1, 2, 3, 4].map((n) => (
          <div key={n}>
            <div className="skeleton aspect-[4/5]" />
            <div className="skeleton h-5 mt-5 w-3/4" />
            <div className="skeleton h-4 mt-3 w-1/3" />
          </div>
        ))}
      </div>
      <p className="sr-only" role="status">
        {t("Loading your next beauty discovery…")}
      </p>
    </main>
  );
}
