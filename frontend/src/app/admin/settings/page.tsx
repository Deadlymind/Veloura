"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Store, Globe2, Flower2 } from "lucide-react";
import { uploadImage } from "@/lib/admin-api";
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
type Settings = {
  currency: string;
  locale: string;
  contact_email: string;
  instagram_url: string;
  tiktok_url: string;
  logo_url: string;
  logo_preview: string;
  low_stock_threshold: number;
};
export default function SettingsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { data, error, loading, reload } = useResource<Settings>("settings");
  const user = useStaff();
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useUnsaved(dirty);
  if (loading) return <Loading />;
  if (!data) return <ErrorNote message={error} retry={reload} />;
  const editable = user?.role === "Administrator";
  return (
    <>
      <PageHeading
        title={t("The details behind your brand")}
        description={t(
          "Make your storefront feel like Veloura, in every little detail.",
        )}
      >
        {editable && (
          <button form="settings-form" className="admin-button" disabled={busy}>
            <Save size={16} />
            {busy ? `Saving… ${progress}%` : t("Save settings")}
          </button>
        )}
      </PageHeading>
      {!editable && (
        <Notice>
          {t("You can review settings. An administrator can make changes.")}
        </Notice>
      )}
      <ErrorNote message={saveError} />
      {notice && <Notice>{notice}</Notice>}
      <form
        id="settings-form"
        key={JSON.stringify(data)}
        onChange={() => {
          setDirty(true);
          setNotice("");
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const file = form.get("logo") as File;
          if (!file?.size) form.delete("logo");
          if (
            form.get("currency")?.toString().toUpperCase() !== data.currency
          ) {
            if (
              !confirm(
                "Changing currency does not convert any prices. Existing numeric prices will use the new currency. Continue?",
              )
            )
              return;
            form.set("confirm_currency_change", "true");
          }
          setBusy(true);
          setSaveError("");
          try {
            await uploadImage("settings", form, setProgress, "PATCH");
            setDirty(false);
            setNotice(
              "Store settings saved. Refresh the storefront to see your changes.",
            );
            reload();
            router.refresh();
          } catch (e) {
            setSaveError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!editable || busy} className="admin-settings-grid">
          <section className="admin-panel admin-form-panel">
            <div className="admin-section-icon">
              <Globe2 size={22} />
              <h2>{t("Currency & locale")}</h2>
            </div>
            <div className="admin-form-grid">
              <Field
                label={t("Currency")}
                hint={t(
                  "Three-letter currency code, such as USD, NGN, GBP or EUR.",
                )}
              >
                <input
                  name="currency"
                  maxLength={3}
                  minLength={3}
                  pattern="[A-Za-z]{3}"
                  required
                  defaultValue={data.currency}
                />
              </Field>
              <Field
                label={t("Locale")}
                hint={t("Controls number formatting, e.g. en-US or en-NG.")}
              >
                <input name="locale" required defaultValue={data.locale} />
              </Field>
            </div>
            <div className="admin-info">
              {t(
                "Currency changes relabel prices; they do not convert amounts. Review your entire price list after changing currency.",
              )}
            </div>
            <Field
              label={t("Low-stock threshold")}
              hint={t(
                "Products or variants at or below this quantity appear in low-stock alerts.",
              )}
            >
              <input
                name="low_stock_threshold"
                type="number"
                min="0"
                max="32767"
                defaultValue={data.low_stock_threshold}
                required
              />
            </Field>
          </section>
          <section className="admin-panel admin-form-panel">
            <div className="admin-section-icon">
              <Store size={22} />
              <h2>{t("Stay connected")}</h2>
            </div>
            <Field label={t("Contact email")}>
              <input
                type="email"
                name="contact_email"
                defaultValue={data.contact_email}
                placeholder={t("Your real contact address")}
              />
            </Field>
            <Field label={t("Instagram URL")}>
              <input
                type="url"
                name="instagram_url"
                defaultValue={data.instagram_url}
                placeholder="https://www.instagram.com/…"
              />
            </Field>
            <Field label={t("TikTok URL")}>
              <input
                type="url"
                name="tiktok_url"
                defaultValue={data.tiktok_url}
                placeholder="https://www.tiktok.com/@…"
              />
            </Field>
            <p className="admin-help">
              {t("Empty contact and social fields stay hidden in the footer.")}
            </p>
          </section>
          <section className="admin-panel admin-form-panel">
            <div className="admin-section-icon">
              <Flower2 size={23} />
              <h2>{t("Your signature")}</h2>
            </div>
            {data.logo_preview ? (
              <img
                className="admin-logo-preview"
                src={data.logo_preview}
                alt={t("Current store logo")}
              />
            ) : (
              <div className="admin-wordmark-preview">
                VELOURA<small>{t("BEAUTY INSPIRES CONFIDENCE")}</small>
              </div>
            )}
            <Field
              label={t("Upload logo")}
              hint={t(
                "JPEG, PNG or WebP up to 10 MB. The image is displayed without stretching.",
              )}
            >
              <input
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </Field>
            <Field
              label={t("Logo URL")}
              hint={t(
                "Optional local /path or HTTPS URL. Uploaded logos take precedence.",
              )}
            >
              <input name="logo_url" defaultValue={data.logo_url} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" name="clear_logo" value="true" />
              {t("Use the text wordmark (clear logo selection)")}
            </label>
          </section>
        </fieldset>
      </form>
    </>
  );
}
