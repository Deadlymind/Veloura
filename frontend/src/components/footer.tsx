"use client";
import { useI18n } from "@/components/i18n-provider";

import Link from "next/link";
import { ArrowUpRight, Flower2 } from "lucide-react";
import type { Category } from "@/lib/types";
import { Logo } from "./header";
import { useStore } from "./store-provider";
export function Footer({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const { config } = useStore();
  const hasContact =
    config.contact_email || config.instagram_url || config.tiktok_url;
  return (
    <footer className="footer">
      <div className="wrap footer-main">
        <div>
          <Logo footer />
          <p>
            {t("Beauty in the everyday.")}
            <br />
            {t("Confidence that is entirely your own.")}
          </p>
        </div>
        <div>
          <h3>{t("Explore")}</h3>
          <Link href="/category/all">{t("All products")}</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <h3>{t("The Veloura edit")}</h3>
          <Link href="/category/all?is_new=true">{t("New arrivals")}</Link>
          <Link href="/category/all?featured=true">{t("Our favorites")}</Link>
          <Link href="/#our-story">{t("Our story")}</Link>
          {hasContact && (
            <div className="contact-links">
              {config.contact_email && (
                <a href={`mailto:${config.contact_email}`}>
                  {t("Get in touch")} <ArrowUpRight size={13} />
                </a>
              )}
              {[
                ["Instagram", config.instagram_url],
                ["TikTok", config.tiktok_url],
              ].map(
                ([name, url]) =>
                  url && (
                    <a key={name} href={url} target="_blank" rel="noreferrer">
                      {name} <ArrowUpRight size={13} />
                    </a>
                  ),
              )}
            </div>
          )}
        </div>
        <div className="footer-quote">
          <Flower2 size={38} strokeWidth={1} />
          <span>
            {t("Beauty Inspires")}
            <br />
            <i>{t("Confidence.")}</i>
          </span>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>
          © {new Date().getFullYear()} {t("Veloura. All rights reserved.")}
        </span>
        <span>
          {config.demo_mode
            ? t("Demo storefront · Illustrative products & imagery")
            : t("Beauty Inspires Confidence.")}
        </span>
        <span>{config.currency}</span>
      </div>
    </footer>
  );
}
