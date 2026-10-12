export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string;
};
export type Variant = {
  id: number;
  name: string;
  shade: string;
  color: string;
  size: string;
  price: string;
  stock: number;
};
export type Product = {
  id: number;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  price: string;
  display_price: string;
  stock: number;
  available: boolean;
  ingredients: string;
  usage: string;
  details: string;
  attribute: string;
  featured: boolean;
  is_new: boolean;
  is_demo: boolean;
  category: Category;
  images: { id: number; url: string; alt: string }[];
  variants: Variant[];
};
export type CatalogPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
};
export type StoreConfig = {
  currency: string;
  locale: string;
  contact_email: string;
  instagram_url: string;
  tiktok_url: string;
  logo_url: string;
  demo_mode: boolean;
  attributes: { category__slug: string; attribute: string; label?: string }[];
};
export type BagInput = {
  product_id: number;
  variant_id: number | null;
  quantity: number;
};
export type BagLine = BagInput & {
  requested_quantity: number;
  stock: number;
  price: string;
  line_total: string;
  name: string;
  slug: string;
  variant_name: string;
  image: string;
  message: string;
};
export type BagResult = {
  items: BagLine[];
  subtotal: string;
  currency: string;
  locale: string;
};
export const bagKey = (line: BagInput) =>
  `${line.product_id}:${line.variant_id ?? "base"}`;
export function money(
  value: string | number,
  currency = "USD",
  locale = "en-US",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}
