import { getCategories, getConfig } from "@/lib/api";
import { StoreProvider } from "@/components/store-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, config] = await Promise.all([
    getCategories().catch(() => []),
    getConfig().catch(() => ({
      currency: "USD",
      locale: "en-US",
      contact_email: "",
      instagram_url: "",
      tiktok_url: "",
      logo_url: "",
      demo_mode: false,
      attributes: [],
    })),
  ]);
  return (
    <StoreProvider config={config}>
      <Header categories={categories} />
      {children}
      <Footer categories={categories} />
    </StoreProvider>
  );
}
