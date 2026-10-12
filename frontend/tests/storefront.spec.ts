import { test, expect } from "@playwright/test";

test("home connects to demo catalog and bag survives refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your Veloura.",
  );
  await expect(
    page.getByRole("link", { name: "Shop the Collection" }),
  ).toBeVisible();
  const add = page.getByRole("button", { name: "Add Dew Drop Serum to bag" });
  await expect(add).toBeEnabled();
  await add.click();
  const drawer = page.getByRole("dialog", { name: "Your beauty bag" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("$38.00").first()).toBeVisible();
  await drawer
    .getByRole("button", { name: "Increase Dew Drop Serum quantity" })
    .click();
  await expect(drawer.getByText("$76.00")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open shopping bag, 2 items" })
    .click();
  await expect(drawer.getByText("$76.00")).toBeVisible();
  await drawer.getByRole("button", { name: "Remove Dew Drop Serum" }).click();
  await expect(drawer.getByText("A little beauty awaits.")).toBeVisible();
});

test("filters, sorting and pagination stay in URL", async ({ page }) => {
  await page.goto("/category/all");
  await expect(page.locator(".catalog-grid .product-card")).toHaveCount(8);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".catalog-grid .product-card")).toHaveCount(4);
  await page.getByLabel("Sort by").selectOption("price");
  await expect(page).toHaveURL(/ordering=price/);
  await expect(page).not.toHaveURL(/page=2/);
  await page.locator(".desktop-filters").getByLabel("Maximum").fill("25");
  await page
    .locator(".desktop-filters")
    .getByRole("button", { name: "Apply filters" })
    .click();
  await expect(page).toHaveURL(/max_price=25/);
  await expect(page.locator(".catalog-grid .product-card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".catalog-grid .product-card")).toHaveCount(2);
});

test("product variants and gallery behave correctly", async ({ page }) => {
  await page.goto("/products/rose-veil-lip-color");
  await expect(
    page.getByRole("button", { name: "Choose an option" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Terracotta — unavailable" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Petal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to Bag", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "View image 2:", exact: false })
    .click();
  await expect(page.locator(".main-product-image img")).toHaveAttribute(
    "alt",
    "Veloura concept collection on warm stone with rose petals",
  );
  await page.getByText("Ingredients", { exact: true }).click();
  await expect(
    page.getByText("Demo product: a verified ingredient list", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to Bag", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Petal", { exact: true }),
  ).toBeVisible();
});

test("size prices update and empty searches have a recovery path", async ({
  page,
}) => {
  await page.goto("/products/the-daily-cream");
  await page.getByRole("button", { name: "50 ml", exact: true }).click();
  await expect(page.locator(".detail-price:visible")).toHaveText("$58.00");
  await page.getByRole("button", { name: "Search products" }).click();
  await page
    .getByRole("searchbox", { name: "Search the collection" })
    .count()
    .then(async (count) => {
      if (count)
        await page.getByRole("searchbox").fill("nonexistent-beauty-item");
      else
        await page
          .getByLabel("Search the collection")
          .fill("nonexistent-beauty-item");
    });
  await page.getByRole("button", { name: "Submit search" }).click();
  await expect(page).toHaveURL(/search=nonexistent/);
  await expect(
    page.getByRole("heading", { name: "A fresh start?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.locator(".catalog-grid .product-card")).toHaveCount(8);
});

test("mobile navigation, filters, dialog keyboard access and no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Skincare", exact: true })
    .click();
  await expect(page).toHaveURL("/category/skincare");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Refine your ritual" });
  await panel.getByLabel("In stock", { exact: true }).check();
  await panel.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/availability=in-stock/);
  await expect(panel).not.toBeVisible();
  await page.getByRole("button", { name: "Filters (1)" }).click();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("catalog and bag failures show useful recovery UI", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Dew Drop Serum to bag" }),
  ).toBeEnabled();
  await page.route("**/api/catalog/bag/validate", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"Unavailable"}',
    }),
  );
  await page
    .getByRole("button", { name: "Open shopping bag, 0 items" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "We couldn’t check your bag",
  );
  await page.unroute("**/api/catalog/bag/validate");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("A little beauty awaits.")).toBeVisible();
});

test("capture desktop and mobile previews", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your Veloura.",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll("img").forEach((img) => (img.loading = "eager"));
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.goto("/products/rose-veil-lip-color");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Rose Veil Lip Color",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll("img").forEach((img) => (img.loading = "eager"));
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({
    path: "test-results/product-mobile.png",
    fullPage: true,
  });
});
