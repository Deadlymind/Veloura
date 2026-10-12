"use client";
import { useState } from "react";
import { Search, ArrowRight, Check, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useStaff } from "@/components/admin/shell";
import {
  useResource,
  PageHeading,
  ErrorNote,
  Loading,
  Pagination,
  Empty,
} from "@/components/admin/shared";
import { staffApi, Paginated } from "@/lib/admin-api";
import { Drawer } from "@/components/drawer";
import { money } from "@/lib/types";
type Order = {
  id: number;
  reference: string;
  full_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  notes: string;
  currency: string;
  subtotal: string;
  status: string;
  is_demo: boolean;
  language: string;
  created_at: string;
  items: {
    id: number;
    product_name: string;
    variant_name: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    sku: string;
  }[];
};
const statuses: Record<string, string> = {
  pending: "Pending confirmation",
  confirmed: "Confirmed — unpaid",
  cancelled: "Cancelled",
};

export default function Orders() {
  const user = useStaff();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { data, error, loading, reload } = useResource<Paginated<Order>>(
    `orders?${new URLSearchParams({ page: String(page), search, status })}`,
  );
  if (user?.role !== "Administrator")
    return (
      <ErrorNote
        message={t("Only administrators can review customer orders.")}
      />
    );
  async function transition(next: string) {
    if (
      !selected ||
      !confirm(
        t(
          next === "confirmed"
            ? "Confirm this unpaid order and reserve its stock?"
            : "Cancel this order? Reserved stock will be released.",
        ),
      )
    )
      return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await staffApi<Order>(`orders/${selected.id}`, {
        method: "PATCH",
        data: { status: next },
      });
      setSelected(updated);
      reload();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeading
        title={t("Orders, thoughtfully handled.")}
        description={t(
          "Review unpaid requests and arrange delivery and payment directly with each customer.",
        )}
      />
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <form
            className="admin-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(
                String(new FormData(event.currentTarget).get("search") || ""),
              );
              setPage(1);
            }}
          >
            <Search size={17} />
            <input
              name="search"
              aria-label={t("Search orders")}
              placeholder={t("Reference, customer or email…")}
            />
            <button>{t("Search")}</button>
          </form>
          <label>
            <span className="sr-only">{t("Order status")}</span>
            <select
              className="order-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("All statuses")}</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ErrorNote message={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : data?.count ? (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("Order reference")}</th>
                    <th>{t("Customer")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Product subtotal")}</th>
                    <th>{t("Date")}</th>
                    <th>
                      <span className="sr-only">{t("Review order")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((order) => (
                    <tr key={order.id}>
                      <td>
                        {order.reference}
                        {order.is_demo && (
                          <small className="admin-badge">{t("Demo")}</small>
                        )}
                      </td>
                      <td>{order.full_name}</td>
                      <td>{t(statuses[order.status])}</td>
                      <td>{money(order.subtotal, order.currency, locale)}</td>
                      <td>
                        {new Date(order.created_at).toLocaleDateString(locale)}
                      </td>
                      <td>
                        <button
                          className="admin-link"
                          aria-label={t("Review order {0}", order.reference)}
                          onClick={() => {
                            setSelected(order);
                            setSaveError("");
                          }}
                        >
                          {t("Review")} <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination count={data.count} page={page} setPage={setPage} />
          </>
        ) : (
          <Empty text={t("No orders match your search.")} />
        )}
      </section>
      <Drawer
        open={!!selected}
        close={() => {
          if (!saving) setSelected(null);
        }}
        title={selected?.reference || t("Order details")}
      >
        {selected && (
          <div className="admin-order-detail">
            <p className="admin-badge">{t(statuses[selected.status])}</p>
            {selected.is_demo && (
              <p className="notice">
                {t("Demo order request — contains illustrative catalog items.")}
              </p>
            )}
            <h2>{t("Customer details")}</h2>
            <p>
              {selected.full_name}
              <br />
              <a href={`mailto:${selected.email}`}>{selected.email}</a>
              <br />
              <a href={`tel:${selected.phone}`}>{selected.phone}</a>
            </p>
            <p>
              {t("Preferred language")}:{" "}
              {t(selected.language === "fr" ? "French" : "English")}
            </p>
            <h2>{t("Delivery address")}</h2>
            <address>
              {[
                selected.address_line1,
                selected.address_line2,
                selected.city,
                selected.region,
                selected.postal_code,
                selected.country,
              ]
                .filter(Boolean)
                .map((part, i) => (
                  <span key={i}>
                    {part}
                    <br />
                  </span>
                ))}
            </address>
            {selected.notes && (
              <>
                <h2>{t("Customer notes")}</h2>
                <p className="whitespace-pre-wrap">{selected.notes}</p>
              </>
            )}
            <h2>{t("Your beauty selection")}</h2>
            {selected.items.map((item) => (
              <div key={item.id} className="admin-order-item">
                <div>
                  <strong>{item.product_name}</strong>
                  <p>
                    {item.variant_name}
                    {item.sku ? ` · ${item.sku}` : ""}
                  </p>
                  <small>
                    {item.quantity} ×{" "}
                    {money(item.unit_price, selected.currency, locale)}
                  </small>
                </div>
                <strong>
                  {money(item.line_total, selected.currency, locale)}
                </strong>
              </div>
            ))}
            <div className="admin-order-item">
              <strong>{t("Product subtotal")}</strong>
              <strong>
                {money(selected.subtotal, selected.currency, locale)}
              </strong>
            </div>
            <p className="admin-help">
              {t(
                "No payment has been collected. Arrange the final amount, delivery charges and any taxes with the customer directly. No automatic email is sent.",
              )}
            </p>
            <ErrorNote message={saveError} />
            {selected.status === "pending" && (
              <button
                disabled={saving}
                className="admin-button w-full"
                onClick={() => void transition("confirmed")}
              >
                <Check size={16} />
                {t("Confirm & reserve stock")}
              </button>
            )}
            {selected.status !== "cancelled" && (
              <button
                disabled={saving}
                className="admin-button secondary w-full mt-4"
                onClick={() => void transition("cancelled")}
              >
                <X size={16} />
                {t("Cancel order")}
              </button>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
