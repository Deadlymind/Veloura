import { test, expect, Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

const credentialsPath = path.resolve("../dashboard-access.txt");
const local = existsSync(credentialsPath)
  ? readFileSync(credentialsPath, "utf8")
  : "";
const username =
  process.env.VELOURA_TEST_USERNAME ||
  local.match(/^Username: (.+)$/m)?.[1]?.trim();
const password =
  process.env.VELOURA_TEST_PASSWORD ||
  local.match(/^Password: (.+)$/m)?.[1]?.trim();
test.skip(
  !username || !password,
  "Provide a local dashboard account or VELOURA_TEST_USERNAME/PASSWORD.",
);
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Username", { exact: true }).fill(username!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
}
async function api(page: Page, url: string, method = "GET", data?: unknown) {
  const token = (await (await page.request.get("/api/staff/csrf")).json())
    .csrfToken;
  return page.request.fetch(`/api/staff/${url}`, {
    method,
    data,
    headers: { "X-CSRFToken": token, Origin: "http://127.0.0.1:3000" },
  });
}

test("staff routes require login and logout clears access", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await login(page);
  await expect(page.locator(".header-main")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get("/api/staff/products")).status()).toBe(403);
});

test("create product, upload images, add variant, publish, and update inventory", async ({
  page,
}) => {
  await login(page);
  let productId = 0;
  const slug = `qa-ritual-${Date.now()}`;
  try {
    await page.getByRole("link", { name: "Add a product" }).click();
    await page
      .getByLabel("Product name", { exact: true })
      .fill("QA Ritual Cream");
    await page.getByLabel("URL slug", { exact: true }).fill(slug);
    await page
      .getByLabel("Category", { exact: true })
      .selectOption({ label: "Skincare" });
    await page
      .getByLabel("Description", { exact: true })
      .fill("Temporary end-to-end test product.");
    await page.getByLabel("Base price", { exact: false }).fill("42.00");
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "QA Ritual Cream" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
    productId = Number(page.url().split("/").pop());
    await page
      .getByLabel("Select product images")
      .setInputFiles(["public/images/cream.png", "public/images/serum.png"]);
    await page.getByRole("button", { name: "Upload 2 images" }).click();
    await expect(
      page.getByText("Images updated.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".admin-image-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Move image 2 earlier" }).click();
    await expect(
      page.getByText("Images updated.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add variant", exact: true })
      .click();
    const variant = page.locator(".admin-variant-form");
    await variant.getByLabel("Variant name", { exact: true }).fill("50 ml");
    await variant.getByLabel("SKU", { exact: true }).fill(slug.toUpperCase());
    await variant.getByLabel("Price override", { exact: true }).fill("55.00");
    await variant.getByLabel("Variant stock", { exact: true }).fill("3");
    await variant.getByLabel("Size", { exact: true }).fill("50 ml");
    await variant.getByRole("button", { name: "Save variant" }).click();
    await expect(
      page.getByLabel("Product stock", { exact: true }),
    ).toBeDisabled();
    await page.getByText("Published on storefront", { exact: false }).click();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(
      page.getByText("Product saved. Your catalog is up to date."),
    ).toBeVisible();
    const detail = await (
      await page.request.get(`/api/catalog/products/${slug}`)
    ).json();
    expect(detail.images).toHaveLength(2);
    expect(detail.variants[0].price).toBe("55.00");
    const image = await page.request.get(detail.images[0].url);
    expect(image.ok()).toBe(true);
    await page.getByRole("link", { name: "Inventory", exact: true }).click();
    await page.getByLabel("Search inventory").fill("QA Ritual Cream");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByLabel("Stock for QA Ritual Cream 50 ml").fill("8");
    await page.getByRole("button", { name: "Save stock" }).click();
    await expect(page.getByText("Currently 8")).toBeVisible();
    await page.getByRole("link", { name: "Activity log", exact: true }).click();
    await page.getByLabel("Search activity").fill("QA Ritual Cream");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator(".admin-audit-entry").first()).toContainText(
      username!,
    );
  } finally {
    if (productId) await api(page, `products/${productId}`, "DELETE");
  }
});

test("images picked before the first save upload in order", async ({
  page,
}) => {
  await login(page);
  let productId = 0;
  try {
    await page.goto("/admin/products/new");
    await page
      .getByLabel("Product name", { exact: true })
      .fill("QA Early Images");
    await page
      .getByLabel("URL slug", { exact: true })
      .fill(`qa-early-images-${Date.now()}`);
    await page.getByLabel("Category", { exact: true }).selectOption({ index: 1 });
    await page
      .getByLabel("Description", { exact: true })
      .fill("Temporary end-to-end test product.");
    await page.getByLabel("Base price", { exact: false }).fill("42.00");
    await page
      .getByLabel("Select product images")
      .setInputFiles(["public/images/cream.png", "public/images/serum.png"]);
    await expect(page.locator(".admin-image-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Move image 2 earlier" }).click();
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
    productId = Number(page.url().split("/").pop());
    await expect(page.locator(".admin-image-card")).toHaveCount(2);
    const saved = await (await api(page, `products/${productId}`)).json();
    expect(saved.images).toHaveLength(2);
    expect(saved.images[0].url).toContain("serum");
  } finally {
    if (productId) await api(page, `products/${productId}`, "DELETE");
  }
});

test("categories and settings save, protect populated categories and warn for currency", async ({
  page,
}) => {
  await login(page);
  const initial = await (await api(page, "settings")).json();
  let categoryId = 0;
  try {
    await page.getByRole("link", { name: "Categories", exact: true }).click();
    await page.getByRole("button", { name: "Add category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Category name").fill("QA Collection");
    await dialog.getByLabel("URL slug").fill(`qa-category-${Date.now()}`);
    await dialog.getByRole("button", { name: "Save category" }).click();
    await expect(
      page.getByText("Category saved.", { exact: true }),
    ).toBeVisible();
    categoryId = (
      await (await api(page, "categories?page_size=100")).json()
    ).results.find((c: { name: string }) => c.name === "QA Collection").id;
    await page
      .locator(".admin-category")
      .filter({
        has: page.getByRole("heading", { name: "Skincare", exact: true }),
      })
      .getByRole("button", { name: "Edit category" })
      .click();
    page.once("dialog", (d) => d.accept());
    await dialog.getByRole("button", { name: "Delete category" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Move this category");
    await page.keyboard.press("Escape");
    await page
      .getByRole("link", { name: "Store settings", exact: true })
      .click();
    await page
      .getByLabel("Contact email", { exact: true })
      .fill("qa@example.com");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByText("Store settings saved.", { exact: false }),
    ).toBeVisible();
    expect(
      (await (await page.request.get("/api/catalog/config")).json())
        .contact_email,
    ).toBe("qa@example.com");
    await page.getByLabel("Currency", { exact: true }).fill("EUR");
    page.once("dialog", async (d) => {
      expect(d.message()).toContain("does not convert");
      await d.dismiss();
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    expect((await (await api(page, "settings")).json()).currency).toBe(
      initial.currency,
    );
  } finally {
    await api(page, "settings", "PATCH", {
      contact_email: initial.contact_email,
      currency: initial.currency,
      confirm_currency_change: true,
    });
    if (categoryId) await api(page, `categories/${categoryId}`, "DELETE");
  }
});

test("unsaved changes protect navigation and sign-out", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Add a product" }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Unsaved draft");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
});

test("dashboard accessibility and responsive screenshots", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => document.fonts.ready);
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your collection" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  for (const route of [
    "/admin/products/new",
    "/admin/settings",
    "/admin/staff",
  ]) {
    await page.goto(route);
    await expect(page.locator(".admin-main h1")).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
