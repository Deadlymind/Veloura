"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { StaffProduct, StaffCategory, Paginated } from "@/lib/admin-api";
import {
  useResource,
  PageHeading,
  Loading,
  ErrorNote,
  Empty,
  Pagination,
} from "@/components/admin/shared";
import { money } from "@/lib/types";
export default function Products() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [demo, setDemo] = useState("");
  const [stock, setStock] = useState("");
  const [order, setOrder] = useState("-created_at");
  const query = new URLSearchParams({
    page: String(page),
    search,
    category,
    is_active: active,
    is_demo: demo,
    stock,
    ordering: order,
  });
  const { data, error, loading, reload } = useResource<Paginated<StaffProduct>>(
    `products?${query}`,
  );
  const categories = useResource<Paginated<StaffCategory>>(
    "categories?page_size=100",
  );
  const settings = useResource<{ currency: string; locale: string }>(
    "settings",
  );
  const filter = (set: (s: string) => void, value: string) => {
    set(value);
    setPage(1);
  };
  return (
    <>
      <PageHeading
        title={t("Your collection")}
        description={t(
          "Considered products. Beautifully presented. All in one place.",
        )}
      >
        <Link className="admin-button" href="/admin/products/new">
          <Plus size={17} />
          {t("Add a product")}
        </Link>
      </PageHeading>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <form
            className="admin-search"
            onSubmit={(e) => {
              e.preventDefault();
              filter(
                setSearch,
                new FormData(e.currentTarget).get("search") as string,
              );
            }}
          >
            <Search size={17} />
            <input
              name="search"
              placeholder={t("Search products…")}
              aria-label={t("Search products")}
            />
            <button>{t("Search")}</button>
          </form>
          <select
            aria-label={t("Sort products")}
            value={order}
            onChange={(e) => filter(setOrder, e.target.value)}
          >
            <option value="-created_at">{t("Newest first")}</option>
            <option value="name">{t("Name A–Z")}</option>
            <option value="price">{t("Price low to high")}</option>
            <option value="-price">{t("Price high to low")}</option>
            <option value="stock_total">{t("Stock low to high")}</option>
          </select>
        </div>
        <div className="admin-filter-row">
          <select
            aria-label={t("Category filter")}
            value={category}
            onChange={(e) => filter(setCategory, e.target.value)}
          >
            <option value="">{t("All categories")}</option>
            {categories.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t("Publication filter")}
            value={active}
            onChange={(e) => filter(setActive, e.target.value)}
          >
            <option value="">{t("All statuses")}</option>
            <option value="true">{t("Published")}</option>
            <option value="false">{t("Unpublished")}</option>
          </select>
          <select
            aria-label={t("Stock filter")}
            value={stock}
            onChange={(e) => filter(setStock, e.target.value)}
          >
            <option value="">{t("All stock levels")}</option>
            <option value="low">{t("Low stock")}</option>
            <option value="out">{t("Out of stock")}</option>
          </select>
          <select
            aria-label={t("Demo filter")}
            value={demo}
            onChange={(e) => filter(setDemo, e.target.value)}
          >
            <option value="">{t("All catalog items")}</option>
            <option value="true">{t("Demo products")}</option>
            <option value="false">{t("Real products")}</option>
          </select>
        </div>
        <ErrorNote message={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("Product")}</th>
                    <th>{t("Category")}</th>
                    <th>{t("Price")}</th>
                    <th>{t("Inventory")}</th>
                    <th>{t("Status")}</th>
                    <th>
                      <span className="sr-only">{t("Edit")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="admin-product-cell"
                        >
                          {p.images[0] ? (
                            <img src={p.images[0].url} alt="" />
                          ) : (
                            <span className="admin-thumb-empty" />
                          )}
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.variants.length
                                ? `${p.variants.length} variants`
                                : p.attribute || t("Single product")}
                              {p.is_demo && t(" · Demo")}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>{p.category_name}</td>
                      <td>
                        {money(
                          p.price,
                          settings.data?.currency,
                          settings.data?.locale,
                        )}
                        {p.variants.length > 0 && (
                          <small>{t("Base price")}</small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-stock ${p.stock_total === 0 ? "empty" : ""}`}
                        >
                          {p.stock_total} {t("available")}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${p.is_active ? "green" : ""}`}
                        >
                          {p.is_active ? t("Published") : t("Unpublished")}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/admin/products/${p.id}`}
                          aria-label={t("Edit {0}", p.name)}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.count === 0 && (
              <Empty
                text={t(
                  "No products match your filters. Try a different search or add your first product.",
                )}
              />
            )}
            {data && (
              <Pagination count={data.count} page={page} setPage={setPage} />
            )}
          </>
        )}
      </section>
    </>
  );
}
