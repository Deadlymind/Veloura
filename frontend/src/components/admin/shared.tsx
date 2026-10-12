"use client";
import { useI18n } from "@/components/i18n-provider";

import {
  useEffect,
  useState,
  useCallback,
  useId,
  isValidElement,
  cloneElement,
  ReactElement,
} from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, AlertCircle } from "lucide-react";
import { clientTranslate } from "@/lib/i18n";
import { staffApi } from "@/lib/admin-api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    staffApi<T>(path)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, setData, error, loading, reload };
}
const dirtyForms = new Set<symbol>();
export function confirmDiscard() {
  return (
    dirtyForms.size === 0 ||
    window.confirm(
      clientTranslate("You have unsaved changes. Discard them and continue?"),
    )
  );
}
function warnBeforeUnload(e: BeforeUnloadEvent) {
  if (dirtyForms.size) {
    e.preventDefault();
    e.returnValue = "";
  }
}
function guardNavigation(e: MouseEvent) {
  const link = (e.target as HTMLElement).closest("a");
  if (
    link &&
    link.target !== "_blank" &&
    link.href !== location.href &&
    !confirmDiscard()
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
}
export function useUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const token = Symbol();
    dirtyForms.add(token);
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      dirtyForms.delete(token);
      if (!dirtyForms.size) {
        window.removeEventListener("beforeunload", warnBeforeUnload);
        document.removeEventListener("click", guardNavigation, true);
      }
    };
  }, [dirty]);
}
export function Loading() {
  const { t } = useI18n();
  return (
    <div className="admin-loading" role="status">
      <LoaderCircle className="animate-spin" size={24} />{" "}
      {t("Loading your workspace…")}
    </div>
  );
}
export function ErrorNote({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { t } = useI18n();
  if (!message) return null;
  return (
    <div className="admin-error" role="alert">
      <AlertCircle size={18} />
      <div>
        {t(message)}
        {retry && (
          <button className="admin-link" onClick={retry}>
            {t("Try again")}
          </button>
        )}
      </div>
    </div>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="admin-notice" role="status">
      {children}
    </p>
  );
}
export function PageHeading({
  eyebrow = "VELOURA WORKSPACE",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="admin-page-heading">
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-heading-actions">{children}</div>
    </div>
  );
}
export function Pagination({
  count,
  page,
  setPage,
  size = 12,
}: {
  count: number;
  page: number;
  setPage: (n: number) => void;
  size?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="admin-pagination">
      <span>
        {count} {t("results · Page")} {page} {t("of")}{" "}
        {Math.max(1, Math.ceil(count / size))}
      </span>
      <div>
        <button
          aria-label={t("Previous page")}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          aria-label={t("Next page")}
          disabled={page * size >= count}
          onClick={() => setPage(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-describedby"?: string;
            }>,
            { id, "aria-describedby": hint ? `${id}-hint` : undefined },
          )
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
