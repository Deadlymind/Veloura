"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flower2,
  Package,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "./store-provider";
import { useI18n } from "./i18n-provider";
import { Photo } from "./photo";
import { bagKey, money } from "@/lib/types";

type Receipt = {
  reference: string;
  subtotal: string;
  currency: string;
  is_demo: boolean;
  status: string;
  payment_status: string;
};
const fields = [
  {
    key: "full_name",
    label: "Full name",
    auto: "name",
    max: 150,
    required: true,
  },
  {
    key: "email",
    label: "Email",
    auto: "email",
    max: 254,
    required: true,
    type: "email",
  },
  {
    key: "phone",
    label: "Phone number",
    auto: "tel",
    max: 40,
    required: true,
    type: "tel",
  },
  {
    key: "address_line1",
    label: "Address",
    auto: "address-line1",
    max: 250,
    required: true,
  },
  {
    key: "address_line2",
    label: "Apartment, suite, etc. (optional)",
    auto: "address-line2",
    max: 250,
  },
  {
    key: "city",
    label: "City",
    auto: "address-level2",
    max: 100,
    required: true,
  },
  {
    key: "region",
    label: "State / region (optional)",
    auto: "address-level1",
    max: 100,
  },
  {
    key: "postal_code",
    label: "Postal code (optional)",
    auto: "postal-code",
    max: 30,
  },
  {
    key: "country",
    label: "Country",
    auto: "country-name",
    max: 100,
    required: true,
  },
];

export function Checkout() {
  const { t, language, locale } = useI18n();
  const {
    bag,
    busy,
    error: bagError,
    notice,
    refreshBag,
    completeOrder,
    openBag,
  } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const inFlight = useRef(false);
  const requestKey = useRef({ hash: "", key: "" });
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const displayLocale = language === "fr" ? locale : bag.locale;
  const valid =
    bag.items.length > 0 &&
    bag.items.every(
      (i) => i.quantity > 0 && i.quantity === i.requested_quantity,
    );
  useEffect(() => {
    if (receipt) summaryHeading.current?.focus();
  }, [receipt]);
  useEffect(() => {
    if (error) errorsRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || busy || !valid || bagError) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    const values = new FormData(event.currentTarget);
    const items = bag.items.map((line) => ({
      product_id: line.product_id,
      variant_id: line.variant_id,
      quantity: line.quantity,
      expected_price: line.price,
    }));
    const data = {
      ...Object.fromEntries(
        fields.map((field) => [
          field.key,
          String(values.get(field.key) || "").trim(),
        ]),
      ),
      notes: String(values.get("notes") || "").trim(),
      acknowledged: values.get("acknowledged") === "on",
      currency: bag.currency,
      items,
    };
    try {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(data)),
      );
      const hash = Array.from(new Uint8Array(hashBuffer), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (!requestKey.current.key) {
        try {
          requestKey.current = JSON.parse(
            sessionStorage.getItem("veloura-checkout-key") ||
              '{"hash":"","key":""}',
          );
        } catch {
          /* Storage is optional. */
        }
      }
      if (requestKey.current.hash !== hash || !requestKey.current.key) {
        requestKey.current = { hash, key: crypto.randomUUID() };
        try {
          sessionStorage.setItem(
            "veloura-checkout-key",
            JSON.stringify(requestKey.current),
          );
        } catch {
          /* Retained in memory for retries. */
        }
      }
      const csrf = await fetch("/api/catalog/checkout", { cache: "no-store" });
      if (!csrf.ok) throw new Error(t("Unable to start a secure session."));
      const token = (await csrf.json()).csrfToken;
      const response = await fetch("/api/catalog/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify({
          ...data,
          idempotency_key: requestKey.current.key,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => {
        throw new Error(
          t(
            "We could not submit your request. Please try again. Your bag is safe.",
          ),
        );
      });
      if (!response.ok) {
        if (response.status === 409) {
          await refreshBag();
          throw new Error(
            t(
              result.detail ||
                "Your bag changed. Review current prices and availability, then submit again.",
            ),
          );
        }
        if (response.status === 400) {
          const errors: Record<string, string> = {};
          for (const [key, value] of Object.entries(result))
            errors[key] = (Array.isArray(value) ? value : [value])
              .map((v) => t(String(v)))
              .join(" ");
          setFieldErrors(errors);
          throw new Error(
            t("Please check the highlighted details and try again."),
          );
        }
        throw new Error(
          t(
            result.detail ||
              "We could not submit your request. Please try again. Your bag is safe.",
          ),
        );
      }
      requestKey.current = { hash: "", key: "" };
      try {
        sessionStorage.removeItem("veloura-checkout-key");
      } catch {
        /* Optional storage. */
      }
      setReceipt(result);
      await completeOrder(items);
    } catch (err) {
      setError(
        err instanceof Error &&
          err.name !== "TimeoutError" &&
          err.name !== "TypeError"
          ? err.message
          : t(
              "We could not submit your request. Please try again. Your bag is safe.",
            ),
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (receipt)
    return (
      <main className="wrap checkout-receipt" id="main-content">
        <div className="receipt-icon">
          <Check size={30} strokeWidth={1.5} />
        </div>
        <p className="eyebrow">{t("THANK YOU FOR CHOOSING VELOURA")}</p>
        <h1 tabIndex={-1} ref={summaryHeading}>
          {t("Your request is with us.")}
        </h1>
        <p>
          {t(
            "Keep your reference below. Your order is unpaid and awaits manual confirmation. No payment has been taken.",
          )}
        </p>
        <dl className="receipt-details">
          <div>
            <dt>{t("Order reference")}</dt>
            <dd>{receipt.reference}</dd>
          </div>
          <div>
            <dt>{t("Product subtotal")}</dt>
            <dd>{money(receipt.subtotal, receipt.currency, displayLocale)}</dd>
          </div>
          <div>
            <dt>{t("Status")}</dt>
            <dd>
              {t(
                receipt.status === "confirmed"
                  ? "Confirmed — unpaid"
                  : receipt.status === "cancelled"
                    ? "Cancelled"
                    : "Pending confirmation",
              )}
            </dd>
          </div>
        </dl>
        {receipt.is_demo && (
          <p className="notice">
            {t("Demo order request — contains illustrative catalog items.")}
          </p>
        )}
        <p>
          {t(
            "Our team will review availability, delivery charges and any taxes with you before payment. Stock is reserved only when the team confirms your request.",
          )}
        </p>
        <Link href="/category/all" className="button">
          {t("Continue exploring")} <ArrowRight size={17} />
        </Link>
      </main>
    );

  return (
    <main className="wrap checkout-page" id="main-content">
      <Link href="/category/all" className="text-link">
        <ArrowLeft size={16} />
        {t("Back to the collection")}
      </Link>
      <div className="checkout-intro">
        <p className="eyebrow">{t("THE NEXT STEP IN YOUR RITUAL")}</p>
        <h1>{t("A little closer to yours.")}</h1>
        <p>
          {t("Share your details. We’ll take care of the next step together.")}
        </p>
      </div>
      {busy && !bag.items.length ? (
        <p className="status" role="status">
          <RefreshCw className="animate-spin" size={18} />
          {t("Checking prices & availability…")}
        </p>
      ) : !bag.items.length && !bagError ? (
        <div className="checkout-empty">
          <Package size={38} strokeWidth={1} />
          <h2>{t("Your bag is waiting for a little beauty.")}</h2>
          <p>{t("Add a product to begin your order request.")}</p>
          <Link href="/category/all" className="button">
            {t("Explore the collection")} <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="checkout-layout">
          <form onSubmit={submit} className="checkout-form">
            <fieldset disabled={submitting}>
              <legend>
                <span>01</span>
                {t("Your details")}
              </legend>
              <p className="small-muted">
                {t("Used only to review and arrange this order request.")}
              </p>
              <div className="checkout-fields">
                {fields.slice(0, 3).map((field) => (
                  <label
                    key={field.key}
                    className={field.key === "full_name" ? "full" : ""}
                  >
                    <span>{t(field.label)}</span>
                    <input
                      name={field.key}
                      type={field.type || "text"}
                      autoComplete={field.auto}
                      maxLength={field.max}
                      required={field.required}
                      aria-invalid={!!fieldErrors[field.key]}
                      aria-describedby={
                        fieldErrors[field.key]
                          ? `error-${field.key}`
                          : undefined
                      }
                    />
                    {fieldErrors[field.key] && (
                      <small
                        className="stock-warning"
                        id={`error-${field.key}`}
                      >
                        {fieldErrors[field.key]}
                      </small>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={submitting}>
              <legend>
                <span>02</span>
                {t("Where should your ritual arrive?")}
              </legend>
              <div className="checkout-fields">
                {fields.slice(3).map((field) => (
                  <label
                    key={field.key}
                    className={field.key.startsWith("address_") ? "full" : ""}
                  >
                    <span>{t(field.label)}</span>
                    <input
                      name={field.key}
                      autoComplete={field.auto}
                      maxLength={field.max}
                      required={field.required}
                      aria-invalid={!!fieldErrors[field.key]}
                      aria-describedby={
                        fieldErrors[field.key]
                          ? `error-${field.key}`
                          : undefined
                      }
                    />
                    {fieldErrors[field.key] && (
                      <small
                        className="stock-warning"
                        id={`error-${field.key}`}
                      >
                        {fieldErrors[field.key]}
                      </small>
                    )}
                  </label>
                ))}
                <label className="full">
                  <span>{t("Order notes (optional)")}</span>
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    placeholder={t(
                      "Anything that would help us arrange your order?",
                    )}
                  />
                </label>
              </div>
            </fieldset>
            <section className="checkout-manual">
              <ShieldCheck size={23} strokeWidth={1.25} />
              <div>
                <h2>{t("A personal confirmation.")}</h2>
                <p>
                  {t(
                    "No payment is collected here. Delivery charges and any taxes will be confirmed with you before payment.",
                  )}
                </p>
              </div>
            </section>
            <label className="checkout-ack">
              <input
                type="checkbox"
                name="acknowledged"
                required
                disabled={submitting}
              />
              <span>
                {t(
                  "I understand this is an unpaid order request, subject to availability and manual confirmation.",
                )}
              </span>
            </label>
            {(error || bagError) && (
              <div
                ref={errorsRef}
                tabIndex={-1}
                className="error-note"
                role="alert"
              >
                {error || bagError}
                {bagError && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => void refreshBag()}
                  >
                    {t("Try again")}
                  </button>
                )}
              </div>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {!valid && (
              <p className="notice">
                {t(
                  "Review unavailable items or adjusted quantities in your bag before continuing.",
                )}
              </p>
            )}
            <button
              type="submit"
              className="button checkout-submit"
              disabled={submitting || busy || !valid || !!bagError}
            >
              {submitting ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  {t("Submitting your request…")}
                </>
              ) : (
                <>
                  {t("Place unpaid order request")} <ArrowRight size={17} />
                </>
              )}
            </button>
            <p className="checkout-fineprint">
              {t(
                "Stock is checked now and reserved only after manual confirmation.",
              )}
            </p>
          </form>
          <aside className="checkout-summary">
            <div className="checkout-summary-heading">
              <h2>{t("Your beauty selection")}</h2>
              <button
                disabled={submitting}
                className="text-link"
                onClick={openBag}
              >
                {t("Edit bag")}
              </button>
            </div>
            <div className="checkout-lines">
              {bag.items.map((line) => (
                <article key={bagKey(line)}>
                  <div className="checkout-product-photo">
                    <Photo src={line.image} alt={line.name} sizes="80px" />
                  </div>
                  <div>
                    <h3>{line.name}</h3>
                    {line.variant_name && <p>{line.variant_name}</p>}
                    <p>
                      {t("Quantity")}: {line.quantity}
                    </p>
                    {line.message && (
                      <p className="stock-warning">{line.message}</p>
                    )}
                  </div>
                  <strong>
                    {money(line.line_total, bag.currency, displayLocale)}
                  </strong>
                </article>
              ))}
            </div>
            <dl>
              <div>
                <dt>{t("Product subtotal")}</dt>
                <dd>{money(bag.subtotal, bag.currency, displayLocale)}</dd>
              </div>
              <div>
                <dt>{t("Delivery & any taxes")}</dt>
                <dd>{t("To be confirmed")}</dd>
              </div>
              <div className="checkout-due">
                <dt>{t("Payment collected now")}</dt>
                <dd>{money(0, bag.currency, displayLocale)}</dd>
              </div>
            </dl>
            <p className="checkout-summary-note">
              {t(
                "The subtotal is not the final amount payable. Our team will confirm the full amount before payment.",
              )}
            </p>
            <div className="checkout-brand-note">
              <Flower2 size={24} strokeWidth={1} />
              <span>{t("Beauty Inspires Confidence.")}</span>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
