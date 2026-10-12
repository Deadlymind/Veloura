"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AdminBrand } from "@/components/admin/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { staffApi } from "@/lib/admin-api";
import { ErrorNote, Field } from "@/components/admin/shared";
export default function Login() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main id="main-content" className="admin-login">
      <div className="admin-login-art">
        <AdminBrand href="/" />
        <div>
          <p className="eyebrow">{t("BEHIND EVERY BEAUTIFUL DETAIL")}</p>
          <h1>
            {t("A considered collection.")}
            <br />
            <i>{t("A beautifully run store.")}</i>
          </h1>
          <p>
            {t(
              "Your space to curate, care for, and grow the Veloura collection.",
            )}
          </p>
        </div>
        <span>{t("THE VELOURA BRAND WORKSPACE")}</span>
      </div>
      <div className="admin-login-form">
        <LanguageSwitcher />
        <LockKeyhole size={27} strokeWidth={1} />
        <p className="eyebrow">{t("WELCOME BACK")}</p>
        <h2>{t("A little care, behind the scenes.")}</h2>
        <p>{t("Sign in to manage your store.")}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              await staffApi("login", {
                method: "POST",
                data: {
                  username: form.get("username"),
                  password: form.get("password"),
                },
              });
              router.replace("/admin");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Username")}>
            <input name="username" autoComplete="username" required autoFocus />
          </Field>
          <Field label={t("Password")}>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <ErrorNote message={error} />
          <button className="admin-button" disabled={busy}>
            {busy ? t("Signing in…") : t("Sign in to workspace")}
            <ArrowRight size={17} />
          </button>
        </form>
        <small>
          {t(
            "Staff access only. Ask your administrator if you need an account or a password reset.",
          )}
        </small>
        <Link href="/" className="admin-link">
          {t("Back to storefront")}
        </Link>
      </div>
    </main>
  );
}
