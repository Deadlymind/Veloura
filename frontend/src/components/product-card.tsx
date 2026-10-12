"use client";
import { useI18n } from "@/components/i18n-provider";

import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { money } from "@/lib/types";
import { useStore } from "./store-provider";
import { Photo } from "./photo";
export function ProductCard({ product }: { product: Product }) {
  const { t, locale } = useI18n();
  const { config, add, busy } = useStore();
  return (
    <article className="product-card">
      <div className="product-photo">
        <Link
          href={`/products/${product.slug}`}
          className="photo-link"
          aria-label={t("View {0}", product.name)}
        >
          <Photo
            src={product.images[0]?.url || ""}
            alt={product.images[0]?.alt || product.name}
          />
        </Link>
        <div className="product-badges">
          {!product.available ? (
            <span>{t("Out of stock")}</span>
          ) : product.is_new ? (
            <span>{t("New arrival")}</span>
          ) : product.featured ? (
            <span>{t("Our favorite")}</span>
          ) : null}
        </div>
        {product.variants.length ? (
          <Link
            href={`/products/${product.slug}`}
            className="quick-add"
            aria-label={t("Choose options for {0}", product.name)}
          >
            <ArrowUpRight size={18} />
          </Link>
        ) : (
          <button
            className="quick-add"
            disabled={!product.available || busy}
            onClick={() =>
              void add({
                product_id: product.id,
                variant_id: null,
                quantity: 1,
              })
            }
            aria-label={t("Add {0} to bag", product.name)}
          >
            <Plus size={19} />
          </button>
        )}
      </div>
      <div className="product-meta">
        <p className="eyebrow">{product.category.name}</p>
        <Link href={`/products/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p className="product-subtitle">{product.subtitle}</p>
        <div className="product-price">
          {product.variants.some((v) => v.price !== product.display_price) && (
            <span className="small-muted">{t("From")} </span>
          )}
          {money(product.display_price, config.currency, config.locale)}
          {product.variants.some((v) => v.color) && (
            <div
              className="mini-swatches"
              role="img"
              aria-label={`${product.variants.length} shades`}
            >
              {product.variants.map(
                (v) =>
                  v.color && (
                    <span key={v.id} style={{ backgroundColor: v.color }} />
                  ),
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
