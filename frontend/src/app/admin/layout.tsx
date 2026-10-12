import { getTranslator } from "@/lib/i18n-server";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";
import { AdminBrandProvider } from "@/components/admin/brand";
import { getConfig } from "@/lib/api";
import "./admin.css";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
    title: t("Brand Workspace"),
    robots: { index: false, follow: false },
  };
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logo = await getConfig()
    .then((config) => config.logo_url)
    .catch(() => "/images/veloura-logo.png");
  return (
    <AdminBrandProvider logo={logo}>
      <AdminShell>{children}</AdminShell>
    </AdminBrandProvider>
  );
}
