"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, RefreshCw } from "lucide-react";
import { Paginated, staffApi } from "@/lib/admin-api";
import {
  useResource,
  useUnsaved,
  PageHeading,
  Loading,
  ErrorNote,
  Notice,
  Pagination,
  Empty,
} from "@/components/admin/shared";
type Row = {
  product_id: number;
  variant_id: number | null;
  name: string;
  variant: string;
  sku: string;
  stock: number;
  category: string;
  is_active: boolean;
};
export default function Inventory() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get("stock") || "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource<Paginated<Row>>(
    `inventory?${new URLSearchParams({ stock: filter, search, page: String(page) })}`,
  );
  return (
    <>
      <PageHeading
        title={t("Ready for their next ritual")}
        description={t(
          "Manage available quantities. Variant stock is shown separately for accurate updates.",
        )}
      >
        <button className="admin-button secondary" onClick={reload}>
          <RefreshCw size={16} />
          {t("Refresh stock")}
        </button>
      </PageHeading>
      <section className="admin-panel">
        <div className="admin-toolbar">
          <form
            className="admin-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(new FormData(e.currentTarget).get("search") as string);
              setPage(1);
            }}
          >
            <Search size={17} />
            <input
              aria-label={t("Search inventory")}
              name="search"
              placeholder={t("Search products, shades or SKUs…")}
            />
            <button>{t("Search")}</button>
          </form>
          <select
            aria-label={t("Inventory stock filter")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All stock levels")}</option>
            <option value="low">{t("Low stock")}</option>
            <option value="out">{t("Out of stock")}</option>
          </select>
        </div>
        <ErrorNote message={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("Product / variant")}</th>
                  <th>SKU</th>
                  <th>{t("Category")}</th>
                  <th>{t("Available stock")}</th>
                  <th>{t("Update")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.results.map((r) => (
                  <InventoryRow
                    key={`${r.product_id}-${r.variant_id}-${r.stock}`}
                    row={r}
                    reload={reload}
                  />
                ))}
              </tbody>
            </table>
            {data?.count === 0 && (
              <Empty text={t("No inventory matches these filters.")} />
            )}
          </div>
        )}
        {data && (
          <Pagination count={data.count} page={page} setPage={setPage} />
        )}
      </section>
    </>
  );
}
function InventoryRow({ row, reload }: { row: Row; reload: () => void }) {
  const { t } = useI18n();
  const [stock, setStock] = useState(String(row.stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useUnsaved(Number(stock) !== row.stock);
  return (
    <tr>
      <td>
        <Link href={`/admin/products/${row.product_id}`}>
          <strong>{row.name}</strong>
          <small>
            {row.variant || t("Single product")}
            {!row.is_active && t(" · Unpublished")}
          </small>
        </Link>
      </td>
      <td>
        <code>{row.sku}</code>
      </td>
      <td>{row.category}</td>
      <td>
        <input
          className="admin-stock-input"
          aria-label={t(
            "Stock for {0}{1}",
            row.name,
            row.variant ? ` ${row.variant}` : "",
          )}
          type="number"
          min="0"
          max="2147483647"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <small>
          {t("Currently")} {row.stock}
        </small>
      </td>
      <td>
        <button
          className="admin-button secondary small"
          disabled={
            busy ||
            stock === "" ||
            !Number.isInteger(Number(stock)) ||
            Number(stock) < 0 ||
            Number(stock) === row.stock
          }
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await staffApi("inventory", {
                method: "PATCH",
                data: {
                  product_id: row.product_id,
                  variant_id: row.variant_id,
                  stock: Number(stock),
                  expected_stock: row.stock,
                },
              });
              reload();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? t("Saving…") : t("Save stock")}
        </button>
        {error && (
          <p className="admin-inline-error" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
