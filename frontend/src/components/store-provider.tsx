"use client";
import { useI18n } from "@/components/i18n-provider";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import Link from "next/link";
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { BagInput, BagResult, StoreConfig, bagKey, money } from "@/lib/types";
import { Drawer } from "./drawer";
import { Photo } from "./photo";

type StoreContext = {
  config: StoreConfig;
  add: (item: BagInput) => Promise<void>;
  busy: boolean;
  count: number;
  openBag: () => void;
  bag: BagResult;
  error: string;
  notice: string;
  refreshBag: () => Promise<void>;
  completeOrder: (items: BagInput[]) => Promise<void>;
};
const Context = createContext<StoreContext | null>(null);
export function useStore() {
  const context = useContext(Context);
  if (!context) throw new Error("Store provider missing");
  return context;
}
const EMPTY: BagResult = {
  items: [],
  subtotal: "0.00",
  currency: "USD",
  locale: "en-US",
};
const STORAGE = "veloura-bag-v1";
function readBag(): BagInput[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    if (!Array.isArray(stored)) return [];
    const unique = new Map<string, BagInput>();
    for (const item of stored.slice(0, 100))
      if (
        Number.isInteger(item.product_id) &&
        item.product_id > 0 &&
        (item.variant_id === null ||
          (Number.isInteger(item.variant_id) && item.variant_id > 0)) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99
      )
        unique.set(bagKey(item), {
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
        });
    return [...unique.values()];
  } catch {
    return [];
  }
}
export function StoreProvider({
  config,
  children,
}: {
  config: StoreConfig;
  children: ReactNode;
}) {
  const { t, language, locale } = useI18n();
  const [bag, setBag] = useState<BagResult>(EMPTY);
  const input = useRef<BagInput[]>([]);
  const result = useRef<BagResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const validate = useCallback(
    async (items: BagInput[], persist = true) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch("/api/catalog/bag/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw new Error(
            t(
              "We couldn’t check your bag. Please try again. Your saved bag is safe.",
            ),
          );
        const next: BagResult = await response.json();
        const changed = next.items.some((line) => {
          const old = result.current.items.find(
            (i) => bagKey(i) === bagKey(line),
          );
          return old && old.price !== line.price;
        });
        if (changed)
          setNotice(
            t("A product price changed. Your bag now shows the current price."),
          );
        input.current = next.items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity || i.requested_quantity,
        }));
        result.current = next;
        setBag(next);
        if (persist) {
          try {
            localStorage.setItem(STORAGE, JSON.stringify(input.current));
          } catch {
            setNotice(
              t(
                "Your browser could not save this bag. It will last for this visit only.",
              ),
            );
          }
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t("Could not validate your bag."),
        );
      } finally {
        pending.current = false;
        setBusy(false);
        setReady(true);
      }
    },
    [t],
  );
  useEffect(() => {
    input.current = readBag();
    void validate(input.current);
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE) {
        input.current = readBag();
        void validate(input.current, false);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [validate]);
  useEffect(() => {
    const check = () => {
      if (open) void validate(input.current);
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [open, validate]);
  const openBag = () => {
    setOpen(true);
    void validate(input.current);
  };
  const add = async (item: BagInput) => {
    if (pending.current) return;
    const items = input.current.map((i) => ({ ...i }));
    const old = items.find((i) => bagKey(i) === bagKey(item));
    if (old) old.quantity = Math.min(99, old.quantity + item.quantity);
    else items.push(item);
    setOpen(true);
    await validate(items);
  };
  const update = (key: string, quantity: number) =>
    void validate(
      input.current.flatMap((i) =>
        bagKey(i) === key ? (quantity ? [{ ...i, quantity }] : []) : [i],
      ),
    );
  const completeOrder = async (purchased: BagInput[]) => {
    const remaining = readBag().flatMap((item) => {
      const bought = purchased.find((line) => bagKey(line) === bagKey(item));
      const quantity = item.quantity - (bought?.quantity || 0);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    });
    input.current = remaining;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(remaining));
    } catch {
      /* Session bag still clears. */
    }
    if (!remaining.length) {
      setBag(EMPTY);
      result.current = EMPTY;
    }
    await validate(remaining);
  };
  return (
    <Context.Provider
      value={{
        config,
        add,
        busy: busy || !ready,
        count: bag.items.reduce((n, i) => n + i.quantity, 0),
        openBag,
        bag,
        error,
        notice,
        refreshBag: () => validate(input.current),
        completeOrder,
      }}
    >
      {children}
      <Drawer
        open={open}
        close={() => setOpen(false)}
        title={t("Your beauty bag")}
      >
        <div className="bag-content" aria-busy={busy}>
          {busy && (
            <p className="status" role="status">
              <RefreshCw size={15} className="animate-spin" />{" "}
              {t("Checking prices & availability…")}
            </p>
          )}
          {error && (
            <div className="error-note" role="alert">
              {error}
              <button
                className="text-link mt-3"
                onClick={() => void validate(input.current)}
              >
                {t("Try again")} <RefreshCw size={14} />
              </button>
            </div>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {!bag.items.length && !busy && !error ? (
            <div className="empty-bag">
              <ShoppingBag size={42} strokeWidth={1} />
              <h3>{t("A little beauty awaits.")}</h3>
              <p>{t("Your bag is ready for your next everyday favorite.")}</p>
              <Link
                href="/category/all"
                className="button"
                onClick={() => setOpen(false)}
              >
                {t("Explore the collection")} <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="bag-lines">
              {bag.items.map((line) => (
                <article className="bag-line" key={bagKey(line)}>
                  <div className="bag-image">
                    <Photo src={line.image} alt={line.name} sizes="96px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      className="bag-name"
                      href={`/products/${line.slug}`}
                      onClick={() => setOpen(false)}
                    >
                      {line.name}
                    </Link>
                    {line.variant_name && (
                      <p className="small-muted">{line.variant_name}</p>
                    )}
                    <p className="bag-price">
                      {money(
                        line.price,
                        bag.currency,
                        language === "fr" ? locale : bag.locale,
                      )}
                    </p>
                    {line.message && (
                      <p className="stock-warning" role="status">
                        {line.message}
                      </p>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <div className="quantity small">
                        <button
                          aria-label={t("Decrease {0} quantity", line.name)}
                          disabled={busy || line.quantity <= 1}
                          onClick={() =>
                            update(bagKey(line), line.quantity - 1)
                          }
                        >
                          <Minus size={13} />
                        </button>
                        <span role="status" aria-label={t("Quantity")}>
                          {line.quantity}
                        </span>
                        <button
                          aria-label={t("Increase {0} quantity", line.name)}
                          disabled={
                            busy || line.quantity >= Math.min(line.stock, 99)
                          }
                          onClick={() =>
                            update(bagKey(line), line.quantity + 1)
                          }
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button
                        className="icon-button"
                        disabled={busy}
                        onClick={() => update(bagKey(line), 0)}
                        aria-label={t("Remove {0}", line.name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        {bag.items.length > 0 && (
          <div className="bag-summary">
            <div className="flex justify-between">
              <span>{t("Subtotal")}</span>
              <strong>
                {error
                  ? t("Unavailable")
                  : money(
                      bag.subtotal,
                      bag.currency,
                      language === "fr" ? locale : bag.locale,
                    )}
              </strong>
            </div>
            <p>
              {t(
                "Prices and stock are checked against our catalog. Items are not reserved.",
              )}
            </p>
            <p className="demo-note">
              {t(
                "Place an unpaid order request. Delivery charges and any taxes are confirmed separately.",
              )}
            </p>
            {!busy &&
              !error &&
              bag.items.every(
                (item) =>
                  item.quantity > 0 &&
                  item.quantity === item.requested_quantity,
              ) && (
                <Link
                  href="/checkout"
                  className="button w-full"
                  onClick={() => setOpen(false)}
                >
                  {t("Continue to checkout")} <ArrowRight size={16} />
                </Link>
              )}
            <button className="button w-full" onClick={() => setOpen(false)}>
              {t("Continue exploring")} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </Drawer>
    </Context.Provider>
  );
}
