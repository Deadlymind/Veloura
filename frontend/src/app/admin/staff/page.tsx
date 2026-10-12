"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { Plus, ShieldCheck, Pencil } from "lucide-react";
import { StaffUser, staffApi } from "@/lib/admin-api";
import {
  useResource,
  useUnsaved,
  PageHeading,
  Loading,
  ErrorNote,
  Notice,
  Field,
} from "@/components/admin/shared";
import { useStaff } from "@/components/admin/shell";
import { Drawer } from "@/components/drawer";
export default function StaffPage() {
  const { t } = useI18n();
  const currentUser = useStaff();
  const { data, error, loading, reload } = useResource<StaffUser[]>("users");
  const [edit, setEdit] = useState<StaffUser | "new" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  useUnsaved(dirty);
  if (currentUser?.role !== "Administrator")
    return <ErrorNote message="Only administrators can manage team access." />;
  const user = edit && edit !== "new" ? edit : null;
  return (
    <>
      <PageHeading
        title={t("A thoughtful team")}
        description={t(
          "Give the right people the right access to your Veloura workspace.",
        )}
      >
        <button
          className="admin-button"
          onClick={() => {
            setEdit("new");
            setSaveError("");
          }}
        >
          <Plus size={16} />
          {t("Add staff member")}
        </button>
      </PageHeading>
      <div className="admin-info">
        <ShieldCheck size={19} />
        <p>
          <strong>{t("Administrators")}</strong>{" "}
          {t("manage the catalog, store settings and team access.")}{" "}
          <strong>{t("Catalog Editors")}</strong>{" "}
          {t(
            "manage products, categories, imagery and stock, and can view settings and activity.",
          )}
        </p>
      </div>
      <ErrorNote message={error} retry={reload} />
      {notice && <Notice>{notice}</Notice>}
      <section className="admin-panel">
        {loading ? (
          <Loading />
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("Team member")}</th>
                  <th>{t("Role")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Access")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.first_name || u.username}</strong>
                      <small>
                        {u.username}
                        {u.email && ` · ${u.email}`}
                      </small>
                    </td>
                    <td>{t(u.role)}</td>
                    <td>
                      <span
                        className={`admin-badge ${u.is_active ? "green" : ""}`}
                      >
                        {u.is_active ? t("Active") : t("Deactivated")}
                      </span>
                    </td>
                    <td>
                      {u.id === currentUser.id ? (
                        <span className="admin-muted">{t("Your account")}</span>
                      ) : (
                        <button
                          className="admin-link"
                          onClick={() => {
                            setEdit(u);
                            setSaveError("");
                          }}
                        >
                          <Pencil size={14} />
                          {t("Edit access")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Drawer
        open={!!edit}
        close={() => {
          if (!dirty || confirm(t("Discard unsaved staff changes?"))) {
            setEdit(null);
            setDirty(false);
          }
        }}
        title={user ? t("Edit team access") : t("New staff member")}
      >
        <form
          className="admin-form-panel"
          key={user?.id || "new"}
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            if (!values.password) delete values.password;
            setBusy(true);
            setSaveError("");
            try {
              await staffApi(user ? `users/${user.id}` : "users", {
                method: user ? "PATCH" : "POST",
                data: { ...values, is_active: values.is_active === "true" },
              });
              setDirty(false);
              setEdit(null);
              reload();
              setNotice(t("Team access saved."));
            } catch (e) {
              setSaveError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Username")}>
            <input
              name="username"
              required
              autoComplete="off"
              defaultValue={user?.username}
            />
          </Field>
          <Field label={t("First name")}>
            <input name="first_name" defaultValue={user?.first_name} />
          </Field>
          <Field label={t("Email")}>
            <input name="email" type="email" defaultValue={user?.email} />
          </Field>
          <Field
            label={
              user ? t("New password (optional)") : t("Temporary password")
            }
            hint={t(
              "Use at least 10 characters. Common passwords are rejected. Share credentials privately.",
            )}
          >
            <input
              name="password"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required={!user}
            />
          </Field>
          <Field label={t("Role")}>
            <select name="role" defaultValue={user?.role || "Catalog Editor"}>
              <option value="Catalog Editor">{t("Catalog Editor")}</option>
              <option value="Administrator">{t("Administrator")}</option>
            </select>
          </Field>
          <label className="admin-check">
            <input
              name="is_active"
              type="checkbox"
              value="true"
              defaultChecked={user?.is_active ?? true}
            />
            {t("Active account")}
          </label>
          <ErrorNote message={saveError} />
          <button className="admin-button" disabled={busy}>
            {busy ? t("Saving…") : t("Save staff member")}
          </button>
        </form>
      </Drawer>
    </>
  );
}
