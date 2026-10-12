"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  SlidersHorizontal,
  X,
  ArrowLeft,
  ArrowRight,
  Search,
  LoaderCircle,
} from "lucide-react";
import { CatalogPage, StoreConfig } from "@/lib/types";
import { ProductCard } from "./product-card";
import { Drawer } from "./drawer";

export function Catalog({
  data,
  config,
  categorySlug,
}: {
  data: CatalogPage;
  config: StoreConfig;
  categorySlug: string;
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const options = [
    ...new Set(
      config.attributes
        .filter(
          (a) => categorySlug === "all" || a.category__slug === categorySlug,
        )
        .map((a) => a.attribute),
    ),
  ];
  function change(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    startTransition(() =>
      router.push(`${pathname}${next.size ? `?${next}` : ""}`, {
        scroll: false,
      }),
    );
  }
  function apply(form: HTMLFormElement) {
    const values = new FormData(form);
    const min = values.get("min_price")?.toString() || "";
    const max = values.get("max_price")?.toString() || "";
    if (min && max && Number(min) > Number(max)) {
      setFilterError(t("Maximum price must be at least the minimum."));
      return;
    }
    setFilterError("");
    change({
      min_price: min,
      max_price: max,
      availability: values.get("availability")?.toString() || "",
      attribute: values.get("attribute")?.toString() || "",
    });
    setOpen(false);
  }
  const active = [
    "min_price",
    "max_price",
    "availability",
    "attribute",
    "search",
    "featured",
    "is_new",
  ].filter((k) => params.get(k));
  const page = Number(params.get("page") || 1);
  const pages = Math.ceil(data.count / 8);
  function pageHref(n: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(n));
    return `${pathname}?${next}`;
  }
  const filters = (id: string) => (
    <form
      key={params.toString()}
      className="filter-form"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <fieldset>
        <legend>
          {t("Price range")} <span>({config.currency})</span>
        </legend>
        <div className="price-inputs">
          <label>
            {t("Minimum")}
            <input
              name="min_price"
              type="number"
              min="0"
              max="99999999"
              step="0.01"
              placeholder="0"
              defaultValue={params.get("min_price") || ""}
            />
          </label>
          <span>—</span>
          <label>
            {t("Maximum")}
            <input
              name="max_price"
              type="number"
              min="0"
              max="99999999"
              step="0.01"
              placeholder={t("Any")}
              defaultValue={params.get("max_price") || ""}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("Availability")}</legend>
        {[
          ["", t("All products")],
          ["in-stock", t("In stock")],
          ["out-of-stock", t("Out of stock")],
        ].map(([value, text]) => (
          <label className="radio-label" key={value}>
            <input
              type="radio"
              name="availability"
              value={value}
              defaultChecked={(params.get("availability") || "") === value}
            />
            {text}
          </label>
        ))}
      </fieldset>
      {options.length > 0 && (
        <fieldset>
          <legend>{t("Product type")}</legend>
          <label className="sr-only" htmlFor={`${id}-attribute`}>
            {t("Product type")}
          </label>
          <select
            id={`${id}-attribute`}
            name="attribute"
            defaultValue={params.get("attribute") || ""}
          >
            <option value="">{t("All types")}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {config.attributes.find((a) => a.attribute === o)?.label || o}
              </option>
            ))}
          </select>
        </fieldset>
      )}
      {filterError && (
        <p role="alert" className="stock-warning">
          {filterError}
        </p>
      )}
      <button className="button w-full" type="submit" disabled={pending}>
        {t("Apply filters")} <ArrowRight size={16} />
      </button>
      {active.length > 0 && (
        <button
          type="button"
          className="text-link reset-filters"
          onClick={() => {
            setOpen(false);
            setFilterError("");
            startTransition(() => router.push(pathname, { scroll: false }));
          }}
        >
          {t("Clear all filters")} <X size={14} />
        </button>
      )}
    </form>
  );
  return (
    <div className="catalog-body wrap">
      <div className="catalog-toolbar">
        <span className="results-count" role="status">
          {pending
            ? t("Updating collection…")
            : `${data.count} ${data.count === 1 ? t("product") : t("products")}`}
        </span>
        <button
          className="filter-toggle text-link"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal size={17} /> {t("Filters")}{" "}
          {active.length > 0 && `(${active.length})`}
        </button>
        <label className="sort-label">
          {t("Sort by")}
          <select
            value={params.get("ordering") || "newest"}
            onChange={(e) => change({ ordering: e.target.value })}
          >
            <option value="newest">{t("Newest arrivals")}</option>
            <option value="price">{t("Price: low to high")}</option>
            <option value="-price">{t("Price: high to low")}</option>
          </select>
        </label>
      </div>
      {active.length > 0 && (
        <div className="filter-chips">
          {active.map((key) => (
            <button key={key} onClick={() => change({ [key]: "" })}>
              {key === "min_price"
                ? t("Min: ")
                : key === "max_price"
                  ? t("Max: ")
                  : key === "search"
                    ? t("Search: ")
                    : ""}
              {key === "featured"
                ? t("Our favorites")
                : key === "is_new"
                  ? t("New arrivals")
                  : key === "availability"
                    ? t(
                        params.get(key) === "in-stock"
                          ? "In stock"
                          : "Out of stock",
                      )
                    : key === "attribute"
                      ? config.attributes.find(
                          (a) => a.attribute === params.get(key),
                        )?.label || params.get(key)
                      : params.get(key)}
              <X size={13} />
              <span className="sr-only">
                {t("Remove")} {key} {t("filter")}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="catalog-layout">
        <aside className="desktop-filters">
          <h2>
            <SlidersHorizontal size={16} /> {t("Refine your ritual")}
          </h2>
          {filters("desktop")}
        </aside>
        <div
          className={`catalog-results ${pending ? "is-loading" : ""}`}
          aria-busy={pending}
        >
          {pending && (
            <div className="catalog-spinner">
              <LoaderCircle className="animate-spin" size={30} />
            </div>
          )}
          {data.results.length ? (
            <div className="product-grid catalog-grid">
              {data.results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <Search size={35} strokeWidth={1} />
              <h2>{t("A fresh start?")}</h2>
              <p>
                {t(
                  "No products match these choices. Try a different search or clear your filters.",
                )}
              </p>
              <Link href={pathname} className="button">
                {t("Clear filters")} <ArrowRight size={16} />
              </Link>
            </div>
          )}
          {pages > 1 && (
            <nav className="pagination" aria-label={t("Product pagination")}>
              {page > 1 && (
                <Link href={pageHref(page - 1)} aria-label={t("Previous page")}>
                  <ArrowLeft size={17} />
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(
                  (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
                )
                .map((n, i, values) => (
                  <span className="flex items-center" key={n}>
                    {i > 0 && n - values[i - 1] > 1 && (
                      <span className="px-2">…</span>
                    )}
                    <Link
                      href={pageHref(n)}
                      aria-current={n === page ? "page" : undefined}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
              {page < pages && (
                <Link href={pageHref(page + 1)} aria-label={t("Next page")}>
                  <ArrowRight size={17} />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
      <Drawer
        open={open}
        close={() => setOpen(false)}
        title={t("Refine your ritual")}
      >
        {filters("mobile")}
      </Drawer>
    </div>
  );
}
