"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { Search } from "lucide-react";
import { Activity, Paginated } from "@/lib/admin-api";
import {
  useResource,
  PageHeading,
  Loading,
  ErrorNote,
  Pagination,
  Empty,
} from "@/components/admin/shared";
export default function ActivityPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useResource<Paginated<Activity>>(
    `activity?${new URLSearchParams({ page: String(page), search })}`,
  );
  return (
    <>
      <PageHeading
        title={t("A record of every detail")}
        description={t(
          "A read-only history of catalog, price, stock, and settings changes.",
        )}
      />
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
              name="search"
              aria-label={t("Search activity")}
              placeholder={t("Search an item or team member…")}
            />
            <button>{t("Search")}</button>
          </form>
        </div>
        <ErrorNote message={error} retry={reload} />
        {loading ? (
          <Loading />
        ) : (
          <>
            {data?.results.map((a) => (
              <details className="admin-audit-entry" key={a.id}>
                <summary>
                  <span className="admin-activity-dot" />
                  <span>
                    <strong>{a.target}</strong>
                    <small>
                      {a.actor_name} · {t(a.action)}
                    </small>
                  </span>
                  <time>{new Date(a.created_at).toLocaleString(locale)}</time>
                  <span className="admin-badge">{t("View changes")}</span>
                </summary>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t("Field")}</th>
                        <th>{t("Before")}</th>
                        <th>{t("After")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(a.changes).map(([key, value]) => (
                        <tr key={key}>
                          <td>{t(key.replaceAll("_", " "))}</td>
                          <td>{value.before ?? "—"}</td>
                          <td>{value.after ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
            {data?.count === 0 && (
              <Empty text={t("No activity matches your search.")} />
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
