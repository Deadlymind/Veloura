import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n-server";
import { Checkout } from "@/components/checkout";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("Checkout"), robots: { index: false, follow: false } };
}
export default function CheckoutPage() {
  return <Checkout />;
}
