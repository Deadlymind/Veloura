"use client";
import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ShoppingBag,
  Menu,
  X,
  ArrowRight,
  Flower2,
} from "lucide-react";
import type { Category } from "@/lib/types";
import { useStore } from "./store-provider";
import { Drawer } from "./drawer";
import { LanguageSwitcher } from "./language-switcher";

export function Logo({ footer = false }: { footer?: boolean }) {
  const { t } = useI18n();
  const { config } = useStore();
  return (
    <Link
      href="/"
      aria-label={t("Veloura home")}
      className={`brand ${footer ? "footer-brand" : ""}`}
    >
      {config.logo_url ? (
        <img
          src={config.logo_url}
          alt={t("Veloura — Beauty Inspires Confidence")}
          width={1254}
          height={1254}
          className="original-logo"
        />
      ) : (
        <>
          <Flower2 className="brand-flower" strokeWidth={1} />
          <span>
            VELOURA<small>{t("BEAUTY INSPIRES CONFIDENCE")}</small>
          </span>
        </>
      )}
    </Link>
  );
}
export function Header({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const { count, openBag } = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const links = [{ name: t("All Products"), slug: "all" }, ...categories];
  return (
    <>
      <div className="announcement">
        {t("A little beauty. A little confidence.")}{" "}
        <span>{t("Discover your everyday ritual.")}</span>
      </div>
      <header className="header">
        <div className="header-main wrap">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(true)}
            aria-label={t("Open navigation")}
          >
            <Menu size={23} />
          </button>
          <Logo />
          <nav className="desktop-nav" aria-label={t("Main navigation")}>
            {links.map((c) => (
              <Link
                key={c.slug}
                className={pathname === `/category/${c.slug}` ? "active" : ""}
                href={`/category/${c.slug}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <LanguageSwitcher />
            <button
              className="icon-button"
              onClick={() => setSearch(!search)}
              aria-label={search ? t("Close search") : t("Search products")}
              aria-expanded={search}
            >
              {search ? <X size={21} /> : <Search size={21} />}
            </button>
            <button
              className="bag-trigger icon-button"
              onClick={openBag}
              aria-label={t("Open shopping bag, {0} items", count)}
            >
              <ShoppingBag size={21} />
              <span>{count}</span>
            </button>
          </div>
        </div>
        {search && (
          <form
            className="search-form wrap"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget)
                .get("search")
                ?.toString()
                .trim();
              setSearch(false);
              router.push(
                `/category/all${value ? `?search=${encodeURIComponent(value)}` : ""}`,
              );
            }}
          >
            <Search size={19} />
            <label className="sr-only" htmlFor="site-search">
              {t("Search the collection")}
            </label>
            <input
              autoFocus
              id="site-search"
              name="search"
              placeholder={t("Find your next beauty favorite…")}
              maxLength={200}
            />
            <button
              aria-label={t("Submit search")}
              type="submit"
              className="icon-button"
            >
              <ArrowRight size={21} />
            </button>
          </form>
        )}
      </header>
      <Drawer
        open={menu}
        close={() => setMenu(false)}
        title={t("Explore Veloura")}
      >
        <nav className="mobile-nav" aria-label={t("Mobile navigation")}>
          {links.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              onClick={() => setMenu(false)}
            >
              {c.name}
              <ArrowRight size={19} />
            </Link>
          ))}
        </nav>
        <p className="drawer-tagline">{t("Beauty Inspires Confidence.")}</p>
      </Drawer>
    </>
  );
}
