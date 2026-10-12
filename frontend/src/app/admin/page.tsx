"use client";
import { useI18n } from "@/components/i18n-provider";

import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Package,
  Layers3,
  Check,
  Star,
  ArrowRight,
  AlertTriangle,
  Flower2,
} from "lucide-react";
import { useStaff } from "@/components/admin/shell";
import {
  useResource,
  PageHeading,
  Loading,
  ErrorNote,
  Empty,
} from "@/components/admin/shared";
import { Activity } from "@/lib/admin-api";
type Overview = {
  total_products: number;
  active_products: number;
  featured_products: number;
  categories: number;
  out_of_stock: number;
  low_stock: number;
  low_stock_threshold: number;
  incomplete_count: number;
  alerts: {
    product_id: number;
    name: string;
    stock: number;
    is_active: boolean;
  }[];
  incomplete: { id: number; name: string; missing: string[] }[];
  recent_activity: Activity[];
};
export default function Overview() {
  const { t, locale } = useI18n();
  const user = useStaff();
  const { data, error, loading, reload } = useResource<Overview>("overview");
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} retry={reload} />;
  const stats = [
    {
      label: t("Total products"),
      value: data.total_products,
      detail: t("In your collection"),
      icon: Package,
    },
    {
      label: t("Published products"),
      value: data.active_products,
      detail: t("Visible on your storefront"),
      icon: Check,
    },
    {
      label: t("Categories"),
      value: data.categories,
      detail: t("Every part of the ritual"),
      icon: Layers3,
    },
    {
      label: t("Featured products"),
      value: data.featured_products,
      detail: t("Your handpicked edit"),
      icon: Star,
    },
  ];
  return (
    <>
      <PageHeading
        title={t(
          "Welcome back{0}.",
          user?.first_name ? `, ${user.first_name}` : "",
        )}
        description={t(
          "A little attention behind the scenes. A beautiful experience out front.",
        )}
      >
        <Link href="/admin/products/new" className="admin-button">
          <Plus size={17} />
          {t("Add a product")}
        </Link>
      </PageHeading>
      <div className="admin-welcome-banner">
        <div>
          <p className="eyebrow">{t("YOUR COLLECTION, AT A GLANCE")}</p>
          <h2>
            {t("Every detail makes")}
            <br />
            <i>{t("a difference.")}</i>
          </h2>
          <p>
            {t("Keep your catalog considered, current, and ready to discover.")}
          </p>
          <Link href="/admin/products">
            {t("Manage your collection")} <ArrowRight size={16} />
          </Link>
        </div>
        <div
          className="admin-banner-image"
          role="img"
          aria-label={t("Veloura beauty collection")}
        />
      </div>
      <div className="admin-stats">
        {stats.map((s) => (
          <Link
            href={s.icon === Layers3 ? "/admin/categories" : "/admin/products"}
            key={s.label}
            className="admin-stat"
          >
            <div>
              <span>{s.label}</span>
              <s.icon size={18} strokeWidth={1.5} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </Link>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>{t("A little attention needed")}</h2>
              <p>{t("Inventory alerts across products and variants")}</p>
            </div>
            <AlertTriangle size={20} />
          </div>
          <div className="admin-alert-summary">
            <Link href="/admin/inventory?stock=out">
              <strong>{data.out_of_stock}</strong>
              <span>{t("Out of stock")}</span>
            </Link>
            <Link href="/admin/inventory?stock=low">
              <strong>{data.low_stock}</strong>
              <span>
                {t("Low stock · ≤")} {data.low_stock_threshold}
              </span>
            </Link>
          </div>
          {data.alerts.length ? (
            data.alerts.map((a, i) => (
              <Link
                key={i}
                href={`/admin/products/${a.product_id}`}
                className="admin-alert-row"
              >
                <span>
                  {a.name}
                  {!a.is_active && <small>{t("Unpublished")}</small>}
                </span>
                <span
                  className={`admin-badge ${a.stock === 0 ? "warning" : ""}`}
                >
                  {a.stock === 0 ? t("Out of stock") : `${a.stock} left`}
                </span>
                <ArrowUpRight size={14} />
              </Link>
            ))
          ) : (
            <Empty text={t("Stock levels are looking good.")} />
          )}
          <Link className="admin-panel-link" href="/admin/inventory">
            {t("Review inventory")} <ArrowRight size={15} />
          </Link>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>{t("The finishing touches")}</h2>
              <p>
                {data.incomplete_count} {t("products need content")}
              </p>
            </div>
            <Flower2 size={21} strokeWidth={1.5} />
          </div>
          {data.incomplete.length ? (
            data.incomplete.map((p) => (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className="admin-content-alert"
              >
                <strong>{p.name}</strong>
                <span>
                  {t("Add")} {p.missing.join(", ")}
                </span>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <div className="admin-complete">
              <Check size={26} />
              <h3>{t("Beautifully complete.")}</h3>
              <p>
                {t(
                  "Every product has images, ingredients, and usage text. Demo content should still be reviewed before publishing a real catalog.",
                )}
              </p>
            </div>
          )}
          <Link href="/admin/products" className="admin-panel-link">
            {t("Review your products")} <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{t("Recently in your workspace")}</h2>
            <p>{t("Changes made by your team")}</p>
          </div>
          <Link className="admin-link" href="/admin/activity">
            {t("View activity")} <ArrowUpRight size={14} />
          </Link>
        </div>
        {data.recent_activity.length ? (
          data.recent_activity.map((a) => (
            <div className="admin-activity-row" key={a.id}>
              <span className="admin-activity-dot" />
              <div>
                <strong>{a.target}</strong>
                <p>
                  {a.actor_name} {t(a.action)} {t("this item")}
                </p>
              </div>
              <time>{new Date(a.created_at).toLocaleString(locale)}</time>
            </div>
          ))
        ) : (
          <Empty text={t("Your team's changes will appear here.")} />
        )}
      </section>
    </>
  );
}
