import { getTranslator, getLanguage } from "@/lib/i18n-server";
import { I18nProvider } from "@/components/i18n-provider";
import type { Metadata } from "next";
import "./globals.css";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
    title: {
      default: t("Veloura | Beauty Inspires Confidence"),
      template: "%s | Veloura",
    },
    description: t(
      "A considered collection of beauty for your everyday ritual.",
    ),
  };
}
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslator();
  const language = await getLanguage();
  return (
    <html lang={language}>
      <body>
        <a href="#main-content" className="skip-link">
          {t("Skip to content")}
        </a>
        <I18nProvider language={language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
