"use client";
import { useI18n } from "@/components/i18n-provider";

import { createContext, useContext } from "react";
import Link from "next/link";
import { Flower2 } from "lucide-react";

const AdminLogoContext = createContext("");

export function AdminBrandProvider({
  logo,
  children,
}: {
  logo: string;
  children: React.ReactNode;
}) {
  return (
    <AdminLogoContext.Provider value={logo}>
      {children}
    </AdminLogoContext.Provider>
  );
}

export function AdminBrand({
  href = "/admin",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const logo = useContext(AdminLogoContext);
  return (
    <Link
      href={href}
      className={`admin-brand ${className}`}
      aria-label={href === "/" ? t("Veloura home") : t("Veloura dashboard")}
    >
      {logo ? (
        <img
          src={logo}
          alt={t("Veloura — Beauty Inspires Confidence")}
          width={1254}
          height={1254}
          className="admin-brand-logo"
        />
      ) : (
        <>
          <Flower2 size={25} strokeWidth={1} />
          <span>
            VELOURA<small>{t("THE BRAND WORKSPACE")}</small>
          </span>
        </>
      )}
    </Link>
  );
}
