"use client";
import { useI18n } from "./i18n-provider";
import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Drawer({
  open,
  close,
  title,
  children,
}: {
  open: boolean;
  close: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
      if (open) previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const focusable = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ) || []),
        ].filter((el) => el.getClientRects().length);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === ref.current) closeRef.current();
      }}
    >
      <div className="drawer-inner">
        <div className="drawer-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label={t("Close {0}", title.toLowerCase())}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
