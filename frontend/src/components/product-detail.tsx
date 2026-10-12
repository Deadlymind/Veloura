"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { Plus, Minus, ShoppingBag, Check, Flower2 } from "lucide-react";
import { Product, money } from "@/lib/types";
import { useStore } from "./store-provider";
import { Photo } from "./photo";
export function ProductDetail({ product }: { product: Product }) {
  const { t, locale } = useI18n();
  const { config, add, busy } = useStore();
  const [image, setImage] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((v) => v.id === variantId);
  const requiresVariant = product.variants.length > 0;
  const stock = requiresVariant ? variant?.stock || 0 : product.stock;
  const price = variant?.price || product.display_price;
  const selected = product.images[image];
  return (
    <div className="product-detail">
      <div className="gallery">
        <div className="main-product-image">
          <Photo
            key={selected?.id}
            src={selected?.url || ""}
            alt={selected?.alt || product.name}
            sizes="(max-width: 760px) 100vw, 50vw"
            priority
          />
          {product.is_new && (
            <span className="gallery-badge">{t("NEW ARRIVAL")}</span>
          )}
        </div>
        {product.images.length > 1 && (
          <div
            className="thumbnails"
            role="group"
            aria-label={t("Product images")}
          >
            {product.images.map((pic, i) => (
              <button
                key={pic.id}
                onClick={() => setImage(i)}
                aria-label={t("View image {0}: {1}", i + 1, pic.alt)}
                aria-pressed={i === image}
              >
                <Photo src={pic.url} alt={pic.alt} sizes="80px" />
              </button>
            ))}
          </div>
        )}
        <p className="image-disclaimer">
          {product.is_demo &&
            t("Concept imagery · Packaging shown is illustrative")}
        </p>
      </div>
      <div className="product-information">
        <p className="eyebrow">
          {product.category.name} / {product.attribute}
        </p>
        <h1>{product.name}</h1>
        <p className="detail-subtitle">{product.subtitle}</p>
        <p className="detail-price">
          {!variant &&
            requiresVariant &&
            product.variants.some((v) => v.price !== product.display_price) && (
              <span>{t("From")} </span>
            )}
          {money(price, config.currency, config.locale)}
        </p>
        <p className="detail-description">{product.description}</p>
        {requiresVariant && (
          <fieldset className="variant-field">
            <legend>
              {product.variants.some((v) => v.shade)
                ? t("Choose your shade")
                : t("Choose your size")}{" "}
              <span>{variant?.name || t("Selection required")}</span>
            </legend>
            <div className="variant-options">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={v.stock === 0}
                  aria-pressed={variantId === v.id}
                  aria-label={`${v.name}${v.stock === 0 ? t(" — unavailable") : ""}`}
                  className={`variant-option ${variantId === v.id ? "selected" : ""} ${!v.stock ? "unavailable" : ""}`}
                  onClick={() => {
                    setVariantId(v.id);
                    setQuantity(1);
                  }}
                >
                  {v.color && (
                    <span
                      className="shade"
                      style={{ backgroundColor: v.color }}
                    />
                  )}
                  {v.name}
                  {v.stock === 0 && <small>{t("Unavailable")}</small>}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="stock-status" role="status">
          {requiresVariant && !variant ? (
            <span>{t("Select an option to see availability")}</span>
          ) : stock > 0 ? (
            <>
              <Check size={15} />
              <span>{t("In stock · Ready for your ritual")}</span>
            </>
          ) : (
            <span className="stock-warning">{t("Currently out of stock")}</span>
          )}
        </div>
        <div className="purchase-area">
          <div className="quantity">
            <button
              aria-label={t("Decrease quantity")}
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => q - 1)}
            >
              <Minus size={16} />
            </button>
            <span role="status" aria-label={t("Quantity")}>
              {quantity}
            </span>
            <button
              aria-label={t("Increase quantity")}
              disabled={quantity >= Math.min(stock, 99)}
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            className="button add-to-bag"
            disabled={busy || stock === 0 || (requiresVariant && !variant)}
            onClick={() =>
              void add({
                product_id: product.id,
                variant_id: variantId,
                quantity,
              })
            }
          >
            <ShoppingBag size={17} />
            {busy
              ? t("Please wait…")
              : requiresVariant && !variant
                ? t("Choose an option")
                : stock === 0
                  ? t("Out of stock")
                  : t("Add to Bag")}
          </button>
        </div>
        <p className="purchase-note">
          <Flower2 size={16} strokeWidth={1} />{" "}
          {t("A small moment, just for you.")}
        </p>
        {product.is_demo && (
          <p className="demo-note">
            {t(
              "Demo product · Sample price and stock. Ingredient and usage information awaits the final catalog.",
            )}
          </p>
        )}
        <div className="product-accordions">
          {[
            [t("Ingredients"), product.ingredients],
            [t("How to use"), product.usage],
            [t("The details"), product.details],
          ].map(([label, content]) => (
            <details key={label}>
              <summary>
                {label}
                <Plus size={15} />
              </summary>
              <p>{content || t("Details will be added soon.")}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
