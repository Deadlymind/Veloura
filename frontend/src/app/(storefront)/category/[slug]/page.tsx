import { getTranslator } from "@/lib/i18n-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { ApiError, getCategories, getConfig, getProducts } from "@/lib/api";
import { Catalog } from "@/components/catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const t = await getTranslator();
  const { slug } = await params;
  const search = await searchParams;
  const categories = await getCategories();
  const title =
    typeof search.search === "string"
      ? t("Search: {0}", search.search.slice(0, 80))
      : slug === "all"
        ? t("The Collection")
        : categories.find((c) => c.slug === slug)?.name || t("Collection");
  return {
    title,
    description: t(
      "Explore {0} at Veloura. Beauty Inspires Confidence.",
      title.toLowerCase(),
    ),
    robots: search.search ? { index: false, follow: true } : undefined,
  };
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const t = await getTranslator();
  const { slug } = await params;
  const search = await searchParams;
  const [categories, config] = await Promise.all([
    getCategories(),
    getConfig(),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category && slug !== "all") notFound();
  const query = new URLSearchParams({ category: slug });
  for (const key of [
    "search",
    "ordering",
    "min_price",
    "max_price",
    "availability",
    "attribute",
    "featured",
    "is_new",
    "page",
  ])
    if (typeof search[key] === "string") query.set(key, search[key]);
  let data;
  try {
    data = await getProducts(query.toString());
  } catch (e) {
    if (e instanceof ApiError && [400, 404].includes(e.status))
      return (
        <main id="main-content" className="error-page">
          <h1>{t("Let’s refine that search.")}</h1>
          <p>{t("One of the filters or page numbers is not available.")}</p>
          <Link href={`/category/${slug}`} className="button">
            {t("Reset the collection")}
          </Link>
        </main>
      );
    throw e;
  }
  const term = typeof search.search === "string" ? search.search : "";
  const title = term
    ? `Results for “${term}”`
    : search.featured === "true"
      ? t("The favorites edit")
      : search.is_new === "true"
        ? t("New to your ritual")
        : category?.name || t("The collection");
  return (
    <main id="main-content">
      <div className="collection-intro">
        <div className="wrap">
          <nav className="breadcrumbs" aria-label={t("Breadcrumb")}>
            <Link href="/">{t("Home")}</Link>
            <ChevronRight size={12} />
            <span>{category?.name || t("All Products")}</span>
          </nav>
          <p className="eyebrow">{t("BEAUTY, BEAUTIFULLY CONSIDERED")}</p>
          <h1>{title}</h1>
          <p>
            {term
              ? t("Find a little something that feels like you.")
              : category?.description ||
                t(
                  "Your everyday essentials. Your next discovery. A world of beauty to make your own.",
                )}
          </p>
        </div>
      </div>
      <nav className="collection-tabs wrap" aria-label={t("Collections")}>
        {[{ slug: "all", name: t("All Products") }, ...categories].map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            aria-current={c.slug === slug ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <Catalog data={data} config={config} categorySlug={slug} />
    </main>
  );
}
