"use client";
import { useI18n } from "@/components/i18n-provider";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Layers3,
  Boxes,
  Settings,
  History,
  Users,
  ArrowUpRight,
  Flower2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { staffApi, StaffUser } from "@/lib/admin-api";
import { ErrorNote, Loading, confirmDiscard } from "./shared";
import { Drawer } from "@/components/drawer";
import { AdminBrand } from "./brand";
import { LanguageSwitcher } from "@/components/language-switcher";
const Context = createContext<StaffUser | null>(null);
export function useStaff() {
  return useContext(Context);
}
const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Layers3 },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/activity", label: "Activity log", icon: History },
  { href: "/admin/settings", label: "Store settings", icon: Settings },
  { href: "/admin/staff", label: "Team access", icon: Users },
];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (path === "/admin/login") return;
    staffApi<{ user: StaffUser }>("session")
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.status === 403 || e.status === 401) {
          setUser(null);
          router.replace("/admin/login");
        } else setError(e.message);
      });
    setMobile(false);
  }, [path, router]);
  if (path === "/admin/login")
    return <div className="admin-app">{children}</div>;
  if (!user)
    return (
      <div className="admin-app">
        <main id="main-content">
          {error ? (
            <ErrorNote message={error} retry={() => location.reload()} />
          ) : (
            <Loading />
          )}
        </main>
      </div>
    );
  return (
    <Context.Provider value={user}>
      <div className="admin-app admin-shell">
        <aside className="admin-sidebar">
          <AdminBrand />
          <button
            className="admin-mobile-close"
            onClick={() => setMobile(false)}
            aria-label={t("Close navigation")}
          >
            <X size={20} />
          </button>
          <p className="admin-nav-caption">{t("MANAGE YOUR STORE")}</p>
          <nav aria-label={t("Dashboard navigation")}>
            {nav
              .filter(
                (n) =>
                  !["Team access", "Orders"].includes(n.label) ||
                  user.role === "Administrator",
              )
              .map((n) => (
                <Link
                  href={n.href}
                  key={n.href}
                  aria-current={
                    (
                      n.href === "/admin"
                        ? path === n.href
                        : path.startsWith(n.href)
                    )
                      ? "page"
                      : undefined
                  }
                >
                  <n.icon size={18} />
                  {t(n.label)}
                </Link>
              ))}
          </nav>
          <div className="admin-sidebar-bottom">
            <div className="admin-sidebar-note">
              <Flower2 size={24} strokeWidth={1} />
              <p>
                {t("Beautiful details.")}
                <br />
                {t("Thoughtfully managed.")}
              </p>
            </div>
            <Link href="/" target="_blank">
              {t("View storefront")} <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
        <Drawer
          open={mobile}
          close={() => setMobile(false)}
          title={t("Workspace navigation")}
        >
          <AdminBrand className="admin-drawer-brand" />
          <nav
            className="admin-mobile-nav"
            aria-label={t("Mobile dashboard navigation")}
          >
            {nav
              .filter(
                (n) =>
                  !["Team access", "Orders"].includes(n.label) ||
                  user.role === "Administrator",
              )
              .map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobile(false)}
                >
                  <n.icon size={19} />
                  {t(n.label)}
                </Link>
              ))}
            <Link href="/" target="_blank">
              {t("View storefront")} <ArrowUpRight size={16} />
            </Link>
          </nav>
        </Drawer>
        <div className="admin-workspace">
          <header className="admin-topbar">
            <div className="flex items-center gap-3">
              <button
                className="admin-mobile-toggle"
                aria-label={t("Open navigation")}
                onClick={() => setMobile(true)}
              >
                <Menu size={22} />
              </button>
              <AdminBrand className="admin-topbar-brand" />
              <span>
                Veloura <span className="admin-breadcrumb-slash">/</span>{" "}
                {t(
                  nav.find(
                    (n) => n.href !== "/admin" && path.startsWith(n.href),
                  )?.label || "Overview",
                )}
              </span>
            </div>
            <div className="admin-account">
              <LanguageSwitcher />
              <span className="admin-avatar">
                {(user.first_name || user.username).slice(0, 1).toUpperCase()}
              </span>
              <span>
                {user.first_name || user.username}
                <small>{t(user.role)}</small>
              </span>
              <button
                aria-label={t("Sign out")}
                title={t("Sign out")}
                onClick={async () => {
                  if (!confirmDiscard()) return;
                  try {
                    await staffApi("logout", { method: "POST" });
                    setUser(null);
                    router.replace("/admin/login");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>
          <main className="admin-main" id="main-content">
            {error && <ErrorNote message={error} />}
            {children}
          </main>
          <footer className="admin-footer">
            VELOURA <span>{t("Beauty Inspires Confidence.")}</span>
            <span>{t("Catalog workspace")}</span>
          </footer>
        </div>
      </div>
    </Context.Provider>
  );
}
