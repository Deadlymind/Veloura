import { getTranslator } from "@/lib/i18n-server";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flower2,
  Leaf,
  Sparkles,
} from "lucide-react";
import { getCategories, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import { Photo } from "@/components/photo";

export default async function Home() {
  const t = await getTranslator();
  const [categories, favorites, arrivals] = await Promise.all([
    getCategories(),
    getProducts("featured=true&page_size=4"),
    getProducts("is_new=true&page_size=4"),
  ]);
  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> {t("THE BEAUTY OF BEING YOU")}
          </p>
          <h1>
            {t("Your ritual.")}
            <br />
            {t("Your radiance.")}
            <br />
            <i>{t("Your Veloura.")}</i>
          </h1>
          <p className="hero-tagline">{t("Beauty Inspires Confidence.")}</p>
          <p className="hero-description">
            {t("Thoughtfully chosen beauty for the moments")}
            <br className="desktop-break" />{" "}
            {t("that make you feel most like yourself.")}
          </p>
          <Link href="/category/all" className="button">
            {t("Shop the Collection")} <ArrowRight size={17} />
          </Link>
          <div className="hero-footnote">
            <Flower2 size={20} strokeWidth={1} />{" "}
            {t("A little self-care. A beautiful everyday.")}
          </div>
        </div>
        <div className="hero-image">
          <Photo
            src="/images/veloura-hero.png"
            alt={t(
              "Veloura concept cosmetics in peach and rose gold on sculptural stone, with soft rose petals",
            )}
            priority
            sizes="(max-width: 760px) 100vw, 55vw"
          />
          <span className="image-caption">
            {t("THE EVERYDAY BEAUTY COLLECTION · VOL. 01")}
          </span>
          <div className="hero-image-label">
            <span>{t("Considered beauty.")}</span>
            <i>{t("Beautifully yours.")}</i>
          </div>
        </div>
      </section>
      <div className="ritual-strip">
        <span>
          <Flower2 size={18} strokeWidth={1} /> {t("Beauty, on your terms")}
        </span>
        <span>
          <Leaf size={18} strokeWidth={1} /> {t("Rituals to make your own")}
        </span>
        <span>
          <Sparkles size={18} strokeWidth={1} />{" "}
          {t("Everyday moments, elevated")}
        </span>
      </div>
      <section className="section wrap category-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("FIND YOUR EVERYDAY")}</p>
            <h2>{t("A world of beauty")}</h2>
          </div>
          <p>{t("For every part of your ritual.")}</p>
        </div>
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link
              className="category-card"
              href={`/category/${c.slug}`}
              key={c.id}
            >
              <div className="category-image">
                <Photo
                  src={c.image_url}
                  alt={t("Explore the {0} collection", c.name.toLowerCase())}
                />
              </div>
              <div className="category-card-label">
                <span>
                  <small>0{i + 1}</small>
                  <h3>{c.name}</h3>
                </span>
                <ArrowUpRight size={22} strokeWidth={1.5} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section wrap favorites-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("THE VELOURA ESSENTIALS")}</p>
            <h2>{t("Meet your new favorites")}</h2>
          </div>
          <Link href="/category/all?featured=true" className="text-link">
            {t("Shop the edit")} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="product-grid">
          {favorites.results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="brand-story" id="our-story">
        <div className="botanical botanical-left">
          <Leaf size={190} strokeWidth={0.45} />
        </div>
        <div className="story-inner">
          <Flower2 size={30} strokeWidth={1} />
          <p className="eyebrow">{t("A NOTE FROM VELOURA")}</p>
          <h2>
            {t("Beauty begins with")}
            <br />
            <i>{t("feeling like yourself.")}</i>
          </h2>
          <p>
            {t(
              "We believe beauty is personal. It’s the small rituals, the colors you’re drawn to, and the moments you take just for you. Veloura is an invitation to discover what makes you feel confident — every day, in your own way.",
            )}
          </p>
          <span className="story-signature">{t("With love, Veloura")}</span>
        </div>
        <div className="botanical botanical-right">
          <Leaf size={210} strokeWidth={0.45} />
        </div>
      </section>
      <section className="section wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("SOMETHING NEW TO LOVE")}</p>
            <h2>{t("A fresh chapter in your ritual")}</h2>
          </div>
          <Link href="/category/all?is_new=true" className="text-link">
            {t("Explore new arrivals")} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="product-grid">
          {arrivals.results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="closing-note wrap">
        <span className="eyebrow">{t("MAKE A LITTLE TIME FOR YOU")}</span>
        <h2>
          {t("Your everyday,")} <i>{t("beautifully considered.")}</i>
        </h2>
        <Link href="/category/all" className="text-link">
          {t("Find your ritual")} <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
