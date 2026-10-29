"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save,
  ArrowLeft,
  Eye,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Upload,
} from "lucide-react";
import {
  staffApi,
  uploadImage,
  StaffProduct,
  StaffVariant,
  StaffImage,
  StaffCategory,
  Paginated,
} from "@/lib/admin-api";
import {
  useResource,
  useUnsaved,
  PageHeading,
  Loading,
  ErrorNote,
  Notice,
  Field,
} from "./shared";
import { Drawer } from "@/components/drawer";
import { money } from "@/lib/types";
import { TranslationFields, collectTranslations } from "./translation-fields";
type Draft = Pick<
  StaffProduct,
  | "translations"
  | "name"
  | "slug"
  | "subtitle"
  | "category"
  | "description"
  | "price"
  | "stock"
  | "ingredients"
  | "usage"
  | "details"
  | "attribute"
  | "featured"
  | "is_new"
  | "is_active"
  | "is_demo"
>;
const empty: Draft = {
  translations: {},
  name: "",
  slug: "",
  subtitle: "",
  category: 0,
  description: "",
  price: "",
  stock: 0,
  ingredients: "",
  usage: "",
  details: "",
  attribute: "",
  featured: false,
  is_new: false,
  is_active: false,
  is_demo: false,
};
export function ProductEditor({ id }: { id?: string }) {
  const { t, language, locale } = useI18n();
  const router = useRouter();
  const [product, setProduct] = useState<StaffProduct | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [upload, setUpload] = useState<{ index: number; progress: number }>();
  const categories = useResource<Paginated<StaffCategory>>(
    "categories?page_size=100",
  );
  const config = useResource<{ currency: string; locale: string }>("settings");
  useUnsaved(dirty || pendingFiles.length > 0);
  useEffect(() => {
    // A new product whose first images failed to upload lands here flagged.
    if (!id || !new URLSearchParams(window.location.search).has("images"))
      return;
    setError(
      t(
        "Product saved, but some images did not upload. Add them again in Product imagery below.",
      ),
    );
    router.replace(`/admin/products/${id}`);
  }, [id, router, t]);
  const reload = async () => {
    if (id) {
      const p = await staffApi<StaffProduct>(`products/${id}`);
      setProduct(p);
      return p;
    }
  };
  useEffect(() => {
    if (!id) return;
    let live = true;
    staffApi<StaffProduct>(`products/${id}`)
      .then((p) => {
        if (live) {
          setProduct(p);
          setDraft(
            Object.fromEntries(
              Object.keys(empty).map((k) => [k, p[k as keyof Draft]]),
            ) as Draft,
          );
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setNotice("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await staffApi<StaffProduct>(
        id ? `products/${id}` : "products",
        { method: id ? "PATCH" : "POST", data: draft },
      );
      setProduct(saved);
      setDirty(false);
      setNotice(t("Product saved. Your catalog is up to date."));
      if (!id) {
        let uploaded = true;
        try {
          for (const [i, file] of pendingFiles.entries()) {
            setUpload({ index: i, progress: 0 });
            const data = new FormData();
            data.set("product", String(saved.id));
            data.set("image", file);
            data.set("alt", `${saved.name} — product image ${i + 1}`);
            data.set("position", String(i));
            await uploadImage<StaffImage>("images", data, (progress) =>
              setUpload({ index: i, progress }),
            );
          }
        } catch {
          uploaded = false;
        }
        setPendingFiles([]);
        router.replace(
          `/admin/products/${saved.id}${uploaded ? "" : "?images=failed"}`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setUpload(undefined);
    }
  }
  if (loading) return <Loading />;
  return (
    <>
      <Link href="/admin/products" className="admin-back">
        <ArrowLeft size={15} />
        {t("Back to products")}
      </Link>
      <PageHeading
        title={id ? product?.name || t("Edit product") : t("A new addition")}
        description={
          id
            ? t("The details that make your product feel like Veloura.")
            : t(
                "Start with the essentials. Images upload when you save; variants follow after your first save.",
              )
        }
      >
        <button
          className="admin-button secondary"
          onClick={() => setPreview(true)}
        >
          <Eye size={16} />
          {t("Preview changes")}
        </button>
        <button form="product-form" className="admin-button" disabled={busy}>
          <Save size={16} />
          {upload
            ? t(
                "Uploading image {0} of {1}… {2}%",
                upload.index + 1,
                pendingFiles.length,
                upload.progress,
              )
            : busy
              ? t("Saving…")
              : t("Save product")}
        </button>
      </PageHeading>
      <ErrorNote message={error} />
      {notice && <Notice>{notice}</Notice>}
      <form id="product-form" onSubmit={save} className="admin-editor-layout">
        <div>
          <section className="admin-panel admin-form-panel">
            <h2>{t("The essentials")}</h2>
            <Field label={t("Product name")}>
              <input
                required
                value={draft.name}
                onChange={(e) => {
                  change("name", e.target.value);
                  if (!id)
                    change(
                      "slug",
                      e.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    );
                }}
              />
            </Field>
            <div className="admin-form-grid">
              <Field
                label={t("URL slug")}
                hint={t("Changing a published slug changes its product link.")}
              >
                <input
                  required
                  pattern="[-a-zA-Z0-9_]+"
                  value={draft.slug}
                  onChange={(e) => change("slug", e.target.value)}
                />
              </Field>
              <Field label={t("Category")}>
                <select
                  required
                  value={draft.category || ""}
                  onChange={(e) => change("category", Number(e.target.value))}
                >
                  <option value="">{t("Choose a category")}</option>
                  {categories.data?.results.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("Short introduction")}>
              <input
                value={draft.subtitle}
                onChange={(e) => change("subtitle", e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label={t("Description")}>
              <textarea
                required
                rows={5}
                value={draft.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </Field>
            <Field
              label={t("Product type")}
              hint={t(
                "Used as a filter within the collection, e.g. Serum or Lip color.",
              )}
            >
              <input
                value={draft.attribute}
                onChange={(e) => change("attribute", e.target.value)}
                maxLength={60}
              />
            </Field>
          </section>
          {!id && (
            <PendingImages
              files={pendingFiles}
              setFiles={setPendingFiles}
              disabled={busy}
            />
          )}
          <section className="admin-panel admin-form-panel">
            <h2>{t("The product story")}</h2>
            <p className="admin-help">
              {t(
                "Use verified supplier information. Avoid unsupported claims.",
              )}
            </p>
            {(["ingredients", "usage", "details"] as const).map((key) => (
              <Field
                key={key}
                label={
                  key === "usage"
                    ? t("Usage instructions")
                    : key === "ingredients"
                      ? t("Ingredients")
                      : t("Product details")
                }
              >
                <textarea
                  rows={4}
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </Field>
            ))}
          </section>
          <section className="admin-panel admin-form-panel">
            <TranslationFields
              fields={[
                "name",
                "subtitle",
                "description",
                "ingredients",
                "usage",
                "details",
                "attribute",
              ]}
              value={draft.translations}
              onChange={(value) => change("translations", value)}
            />
          </section>
        </div>
        <aside>
          <section className="admin-panel admin-form-panel">
            <h2>{t("Publication")}</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => change("is_active", e.target.checked)}
              />
              <span>
                {t("Published on storefront")}
                <small>{t("Uncheck to keep this product private.")}</small>
              </span>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => change("featured", e.target.checked)}
              />
              {t("Featured in our favorites")}
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.is_new}
                onChange={(e) => change("is_new", e.target.checked)}
              />
              {t("Show new arrival badge")}
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.is_demo}
                onChange={(e) => change("is_demo", e.target.checked)}
              />
              {t("Clearly label as demo data")}
            </label>
            {product?.is_active && (
              <Link
                className="admin-link"
                href={`/products/${product.slug}`}
                target="_blank"
              >
                {t("View saved storefront page")} <Eye size={14} />
              </Link>
            )}
          </section>
          <section className="admin-panel admin-form-panel">
            <h2>{t("Price & stock")}</h2>
            <Field label={t("Base price ({0})", config.data?.currency || "…")}>
              <input
                required
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={draft.price}
                onChange={(e) => change("price", e.target.value)}
              />
            </Field>
            <Field
              label={t("Product stock")}
              hint={
                product?.variants.length
                  ? t(
                      "This product uses variant stock. Update quantities in the variants section or Inventory.",
                    )
                  : t("Available quantity for this product.")
              }
            >
              <input
                disabled={!!product?.variants.length}
                required
                type="number"
                min="0"
                max="2147483647"
                step="1"
                value={draft.stock}
                onChange={(e) => change("stock", Number(e.target.value))}
              />
            </Field>
          </section>
          {id && (
            <section className="admin-panel admin-form-panel">
              <h2>{t("Remove product")}</h2>
              <p className="admin-help">
                {t(
                  "Unpublishing preserves the product. Deleting permanently removes its variants and catalog images.",
                )}
              </p>
              <button
                type="button"
                className="admin-button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      t(
                        "Permanently delete {0}? This cannot be undone.",
                        product?.name || t("Product"),
                      ),
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await staffApi(`products/${id}`, { method: "DELETE" });
                    setDirty(false);
                    router.push("/admin/products");
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={15} />
                {t("Delete product")}
              </button>
            </section>
          )}
        </aside>
      </form>
      {product && (
        <>
          <Images product={product} reload={reload} />
          <Variants product={product} reload={reload} />
        </>
      )}
      <Drawer
        open={preview}
        close={() => setPreview(false)}
        title={t("Product preview")}
      >
        <div className="admin-preview">
          {product?.images[0] && (
            <img src={product.images[0].url} alt={product.images[0].alt} />
          )}
          <p className="eyebrow">
            {categories.data?.results.find((c) => c.id === draft.category)
              ?.name || t("Your category")}
          </p>
          <h2>{draft.name || t("Your product name")}</h2>
          <p>{draft.subtitle}</p>
          <strong>
            {money(
              draft.price || 0,
              config.data?.currency,
              language === "fr" ? locale : config.data?.locale,
            )}
          </strong>
          <p>
            {draft.description ||
              t("Your product description will appear here.")}
          </p>
          <small>
            {t("Preview of your current fields. Save to update the catalog.")}
          </small>
        </div>
      </Drawer>
    </>
  );
}
function PendingImages({
  files,
  setFiles,
  disabled,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return (
    <section className="admin-panel admin-form-panel">
      <h2>{t("Product imagery")}</h2>
      <p className="admin-help">
        {t(
          "The first image is your cover. Upload JPEG, PNG or WebP files up to 10 MB each.",
        )}{" "}
        {t("Selected images upload when you save the product.")}
      </p>
      {files.length > 0 && (
        <div className="admin-images">
          {files.map((file, index) => (
            <div className="admin-image-card" key={`${file.name}-${index}`}>
              {urls[index] && <img src={urls[index]} alt={file.name} />}
              <span className="admin-badge">
                {index === 0 ? t("Cover image") : t("Image {0}", index + 1)}
              </span>
              <div className="admin-image-actions">
                {[-1, 1].map((delta) => (
                  <button
                    type="button"
                    key={delta}
                    disabled={
                      disabled ||
                      index + delta < 0 ||
                      index + delta >= files.length
                    }
                    aria-label={t(
                      "Move image {0} {1}",
                      index + 1,
                      t(delta === -1 ? "earlier" : "later"),
                    )}
                    onClick={() => {
                      const next = [...files];
                      [next[index], next[index + delta]] = [
                        next[index + delta],
                        next[index],
                      ];
                      setFiles(next);
                    }}
                  >
                    {delta === -1 ? (
                      <ArrowUp size={15} />
                    ) : (
                      <ArrowDown size={15} />
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t("Delete image {0}", index + 1)}
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="admin-upload">
        <Upload size={24} strokeWidth={1.5} />
        <label>
          {t("Select product images")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={disabled}
            onChange={(e) => {
              setFiles([...files, ...(e.target.files || [])]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}
function Images({
  product,
  reload,
}: {
  product: StaffProduct;
  reload: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [alt, setAlt] = useState<Record<number, string>>({});
  const [altFr, setAltFr] = useState<Record<number, string>>({});
  useUnsaved(
    files.length > 0 ||
      Object.keys(alt).length > 0 ||
      Object.keys(altFr).length > 0,
  );
  async function act(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await reload();
      setNotice(t("Images updated."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel admin-form-panel">
      <h2>{t("Product imagery")}</h2>
      <p className="admin-help">
        {t(
          "The first image is your cover. Upload JPEG, PNG or WebP files up to 10 MB each.",
        )}
      </p>
      <ErrorNote message={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="admin-images">
        {product.images.map((image, index) => (
          <div className="admin-image-card" key={image.id}>
            <img src={image.url} alt={image.alt} />
            <span className="admin-badge">
              {index === 0 ? t("Cover image") : t("Image {0}", index + 1)}
            </span>
            <Field label={t("Alt text for image {0}", index + 1)}>
              <input
                value={alt[image.id] ?? image.alt}
                onChange={(e) =>
                  setAlt((a) => ({ ...a, [image.id]: e.target.value }))
                }
              />
            </Field>
            <Field
              label={`${t("Alt text for image {0}", index + 1)} — ${t("French")}`}
            >
              <input
                lang="fr"
                maxLength={250}
                value={altFr[image.id] ?? image.translations?.fr?.alt ?? ""}
                onChange={(e) =>
                  setAltFr((a) => ({ ...a, [image.id]: e.target.value }))
                }
              />
            </Field>
            <div className="admin-image-actions">
              <button
                disabled={
                  busy ||
                  (!(image.id in alt) && !(image.id in altFr)) ||
                  !(alt[image.id] ?? image.alt).trim()
                }
                onClick={() =>
                  act(async () => {
                    await staffApi(`images/${image.id}`, {
                      method: "PATCH",
                      data: {
                        alt: alt[image.id] ?? image.alt,
                        translations: {
                          fr: {
                            alt:
                              altFr[image.id] ??
                              image.translations?.fr?.alt ??
                              "",
                          },
                        },
                      },
                    });
                    setAltFr((a) => {
                      const next = { ...a };
                      delete next[image.id];
                      return next;
                    });
                    setAlt((a) => {
                      const next = { ...a };
                      delete next[image.id];
                      return next;
                    });
                  })
                }
              >
                {t("Save alt")}
              </button>
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  disabled={
                    busy ||
                    index + delta < 0 ||
                    index + delta >= product.images.length
                  }
                  aria-label={t(
                    "Move image {0} {1}",
                    index + 1,
                    t(delta === -1 ? "earlier" : "later"),
                  )}
                  onClick={() =>
                    act(async () => {
                      const ids = product.images.map((i) => i.id);
                      [ids[index], ids[index + delta]] = [
                        ids[index + delta],
                        ids[index],
                      ];
                      await staffApi(`products/${product.id}/reorder_images`, {
                        method: "POST",
                        data: { ids },
                      });
                    })
                  }
                >
                  {delta === -1 ? (
                    <ArrowUp size={15} />
                  ) : (
                    <ArrowDown size={15} />
                  )}
                </button>
              ))}
              <button
                disabled={busy}
                aria-label={t("Delete image {0}", index + 1)}
                onClick={() => {
                  if (confirm(t("Remove this image from the product?")))
                    void act(() =>
                      staffApi(`images/${image.id}`, { method: "DELETE" }),
                    );
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <form
        className="admin-upload"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          void act(async () => {
            for (const [i, file] of files.entries()) {
              const data = new FormData();
              data.set("product", String(product.id));
              data.set("image", file);
              data.set(
                "alt",
                `${product.name} — product image ${product.images.length + i + 1}`,
              );
              data.set("position", String(product.images.length + i));
              await uploadImage<StaffImage>("images", data, setProgress);
            }
            setFiles([]);
            form.reset();
          });
        }}
      >
        <Upload size={24} strokeWidth={1.5} />
        <label>
          {t("Select product images")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => setFiles([...(e.target.files || [])])}
          />
        </label>
        <button
          className="admin-button secondary"
          disabled={busy || !files.length}
        >
          {busy
            ? t("Uploading… {0}%", progress)
            : t(
                "Upload{0}",
                files.length
                  ? ` ${files.length} image${files.length > 1 ? "s" : ""}`
                  : " images",
              )}
        </button>
        {busy && (
          <progress
            value={progress}
            max={100}
            aria-label={t("Image upload progress")}
          />
        )}
      </form>
    </section>
  );
}
function Variants({
  product,
  reload,
}: {
  product: StaffProduct;
  reload: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  return (
    <section className="admin-panel admin-form-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{t("Shades & sizes")}</h2>
          <p>
            {t("When variants exist, their stock replaces the product stock.")}
          </p>
        </div>
        <button
          className="admin-button secondary"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus size={16} />
          {t("Add variant")}
        </button>
      </div>
      {product.variants.map((v) => (
        <VariantForm
          key={v.id}
          variant={v}
          productId={product.id}
          saved={reload}
        />
      ))}
      {adding && (
        <VariantForm
          productId={product.id}
          saved={async () => {
            await reload();
            setAdding(false);
          }}
          cancel={() => setAdding(false)}
        />
      )}
      {!product.variants.length && !adding && (
        <p className="admin-help">
          {t(
            "This is a single-option product. Add variants if customers should choose a shade or size.",
          )}
        </p>
      )}
    </section>
  );
}
function VariantForm({
  variant,
  productId,
  saved,
  cancel,
}: {
  variant?: StaffVariant;
  productId: number;
  saved: () => Promise<unknown>;
  cancel?: () => void;
}) {
  const { t } = useI18n();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useUnsaved(dirty);
  return (
    <form
      className="admin-variant-form"
      onChange={() => {
        setDirty(true);
        setNotice("");
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(
          collectTranslations(new FormData(e.currentTarget)),
        );
        setBusy(true);
        setError("");
        try {
          await staffApi(variant ? `variants/${variant.id}` : "variants", {
            method: variant ? "PATCH" : "POST",
            data: {
              ...values,
              translations: JSON.parse(String(values.translations)),
              product: productId,
              price: values.price || null,
              stock: Number(values.stock),
              position: Number(values.position),
            },
          });
          setDirty(false);
          setNotice(t("Variant saved."));
          await saved();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <TranslationFields
        fields={["name", "shade", "size"]}
        value={variant?.translations}
      />
      <h3>{variant?.name || t("New variant")}</h3>
      <div className="admin-form-grid three">
        <Field label={t("Variant name")}>
          <input name="name" defaultValue={variant?.name} required />
        </Field>
        <Field label="SKU">
          <input name="sku" defaultValue={variant?.sku} required />
        </Field>
        <Field
          label={t("Price override")}
          hint={t("Leave empty to use base price.")}
        >
          <input
            name="price"
            type="number"
            min="0.01"
            max="99999999.99"
            step="0.01"
            defaultValue={variant?.price || ""}
          />
        </Field>
        <Field label={t("Shade name")}>
          <input name="shade" defaultValue={variant?.shade} />
        </Field>
        <Field label={t("Swatch hex color")}>
          <input
            name="color"
            placeholder="#C18B7C"
            pattern="#[0-9a-fA-F]{6}"
            defaultValue={variant?.color}
          />
        </Field>
        <Field label={t("Size")}>
          <input
            name="size"
            placeholder="e.g. 50 ml"
            defaultValue={variant?.size}
          />
        </Field>
        <Field label={t("Variant stock")}>
          <input
            name="stock"
            type="number"
            min="0"
            max="2147483647"
            required
            defaultValue={variant?.stock ?? 0}
          />
        </Field>
        <Field label={t("Display order")}>
          <input
            name="position"
            type="number"
            min="0"
            max="32767"
            defaultValue={variant?.position ?? 0}
          />
        </Field>
      </div>
      <ErrorNote message={error} />
      {notice && <Notice>{notice}</Notice>}
      <div className="admin-form-actions">
        <button className="admin-button secondary" disabled={busy}>
          {busy ? t("Saving…") : t("Save variant")}
        </button>
        {cancel && (
          <button type="button" className="admin-link" onClick={cancel}>
            {t("Cancel")}
          </button>
        )}
        {variant && (
          <button
            type="button"
            className="admin-link danger-text"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  t(
                    "Delete {0}? Existing bag items using this variant will become unavailable.",
                    variant.name,
                  ),
                )
              )
                return;
              setBusy(true);
              try {
                await staffApi(`variants/${variant.id}`, { method: "DELETE" });
                setDirty(false);
                await saved();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {t("Delete variant")}
          </button>
        )}
      </div>
    </form>
  );
}
