"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { Plus, ArrowUpRight, Trash2 } from "lucide-react";
import {
  StaffCategory,
  Paginated,
  staffApi,
  uploadImage,
} from "@/lib/admin-api";
import {
  useResource,
  useUnsaved,
  PageHeading,
  Loading,
  ErrorNote,
  Field,
  Notice,
  Pagination,
  Empty,
} from "@/components/admin/shared";
import { Drawer } from "@/components/drawer";
import {
  TranslationFields,
  collectTranslations,
} from "@/components/admin/translation-fields";
export default function Categories() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource<
    Paginated<StaffCategory>
  >(`categories?page=${page}`);
  const [edit, setEdit] = useState<StaffCategory | "new" | null>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState(0);
  useUnsaved(dirty);
  const current = edit && edit !== "new" ? edit : null;
  const close = () => {
    if (!dirty || confirm(t("Discard your unsaved category changes?"))) {
      setDirty(false);
      setEdit(null);
      setSaveError("");
    }
  };
  return (
    <>
      <PageHeading
        title={t("Every part of the ritual")}
        description={t(
          "Organize your collection into thoughtful, easy-to-explore categories.",
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
          {t("Add category")}
        </button>
      </PageHeading>
      <ErrorNote message={error} retry={reload} />
      {notice && <Notice>{notice}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        <div className="admin-category-grid">
          {data?.results.map((c) => (
            <article className="admin-panel admin-category" key={c.id}>
              {c.preview_image ? (
                <img src={c.preview_image} alt={c.name} />
              ) : (
                <div className="admin-category-placeholder" />
              )}
              <div>
                <span className="eyebrow">
                  {c.product_count} {t("PRODUCTS · ORDER")} {c.position}
                </span>
                <h2>{c.name}</h2>
                <p>
                  {c.description || t("Add an introduction to this category.")}
                </p>
                <button
                  className="admin-link"
                  onClick={() => {
                    setEdit(c);
                    setSaveError("");
                  }}
                >
                  {t("Edit category")} <ArrowUpRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {data?.count === 0 && (
        <Empty
          text={t("Add your first category to start organizing products.")}
        />
      )}
      {data && <Pagination count={data.count} page={page} setPage={setPage} />}
      <Drawer
        open={!!edit}
        close={close}
        title={current ? t("Edit category") : t("New category")}
      >
        <form
          key={current?.id || "new"}
          className="admin-form-panel"
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setSaveError("");
            const form = collectTranslations(new FormData(e.currentTarget));
            const file = form.get("image") as File;
            if (!file?.size) form.delete("image");
            try {
              await uploadImage(
                current ? `categories/${current.id}` : "categories",
                form,
                setProgress,
                current ? "PATCH" : "POST",
              );
              setDirty(false);
              setEdit(null);
              setNotice(t("Category saved."));
              reload();
            } catch (err) {
              setSaveError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Category name")}>
            <input name="name" required defaultValue={current?.name} />
          </Field>
          <Field label={t("URL slug")}>
            <input
              name="slug"
              required
              pattern="[-a-zA-Z0-9_]+"
              defaultValue={current?.slug}
            />
          </Field>
          <Field label={t("Introduction")}>
            <textarea
              name="description"
              rows={4}
              defaultValue={current?.description}
            />
          </Field>
          <TranslationFields
            fields={["name", "description"]}
            value={current?.translations}
          />
          <Field label={t("Display order")}>
            <input
              name="position"
              type="number"
              min="0"
              max="32767"
              defaultValue={current?.position ?? 0}
            />
          </Field>
          <Field label={t("Category image")}>
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </Field>
          <Field
            label={t("Image URL")}
            hint={t(
              "Optional local path or HTTPS URL; an uploaded image takes precedence.",
            )}
          >
            <input name="image_url" defaultValue={current?.image_url} />
          </Field>
          <ErrorNote message={saveError} />
          <button className="admin-button" disabled={busy}>
            {busy ? `Saving… ${progress}%` : t("Save category")}
          </button>
          {current && (
            <button
              type="button"
              className="admin-button danger mt-4"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    t(
                      "Delete {0}? Categories with products cannot be deleted.",
                      current.name,
                    ),
                  )
                )
                  return;
                setBusy(true);
                try {
                  await staffApi(`categories/${current.id}`, {
                    method: "DELETE",
                  });
                  setDirty(false);
                  setEdit(null);
                  reload();
                  setNotice(t("Category deleted."));
                } catch (e) {
                  setSaveError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} />
              {t("Delete category")}
            </button>
          )}
        </form>
      </Drawer>
    </>
  );
}
