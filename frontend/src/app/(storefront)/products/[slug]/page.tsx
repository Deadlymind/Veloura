import { getTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowRight } from "lucide-react";
import { ApiError, getProduct, getProducts } from "@/lib/api";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";
type Props = { params: Promise<{ slug: string }> };
async function load(slug: string) {
  try {
    return await getProduct(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await load((await params).slug);
  return {
    title: product.name,
    description: product.subtitle,
    openGraph: {
      title: `${product.name} | Veloura`,
      description: product.subtitle,
      images: product.images[0] ? [product.images[0].url] : [],
    },
  };
}
export default async function ProductPage({ params }: Props) {
  const t = await getTranslator();
  const product = await load((await params).slug);
  const related = await getProducts(
    `category=${product.category.slug}&page_size=5`,
  );
  return (
    <main id="main-content" className="wrap">
      <nav
        className="breadcrumbs product-breadcrumbs"
        aria-label={t("Breadcrumb")}
      >
        <Link href="/">{t("Home")}</Link>
        <ChevronRight size={12} />
        <Link href={`/category/${product.category.slug}`}>
          {product.category.name}
        </Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </nav>
      <ProductDetail product={product} />
      {related.results.some((p) => p.id !== product.id) && (
        <section className="section related">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("A BEAUTIFUL PAIRING")}</p>
              <h2>{t("Complete your ritual")}</h2>
            </div>
            <Link
              className="text-link"
              href={`/category/${product.category.slug}`}
            >
              {t("Explore")} {product.category.name.toLowerCase()}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="product-grid">
            {related.results
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
