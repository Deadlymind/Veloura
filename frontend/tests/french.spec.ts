import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const credentials = readFileSync("../dashboard-access.txt", "utf8");
const username = credentials.match(/^Username: (.+)$/m)![1].trim();
const password = credentials.match(/^Password: (.+)$/m)![1].trim();
async function api(page: Page, path: string, method = "GET", data?: unknown) {
  const token = (await (await page.request.get("/api/staff/csrf")).json())
    .csrfToken;
  const response = await page.request.fetch(`/api/staff/${path}`, {
    method,
    data,
    headers: { "X-CSRFToken": token, Origin: "http://127.0.0.1:3000" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function login(page: Page) {
  await page.goto("/admin/login");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByLabel("Nom d’utilisateur", { exact: true }).fill(username);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Heureux de vous retrouver." }),
  ).toBeVisible();
}

test("French choice persists, renders on server, and preserves filtered URLs", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("fr");
  await expect(
    page.getByRole("heading", {
      name: "Votre rituel. Votre éclat. Votre Veloura.",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page).toHaveTitle(/La beauté inspire la confiance/);
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('lang="fr"');
  expect(html).toContain("Votre rituel.");
  await page.screenshot({ path: "test-results/french-home-desktop.png" });
  await page.goto("/category/all?ordering=price&availability=in-stock");
  await expect(
    page.getByRole("heading", { name: "La collection", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Langue", exact: true })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/ordering=price&availability=in-stock/);
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("fr");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Langue", exact: true }),
  ).toHaveValue("fr");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Filtres", exact: false }).click();
  await expect(
    page.getByRole("dialog", { name: "Affinez votre rituel" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fermer Affinez votre rituel" })
    .click();
  await page.goto("/");
  await page.screenshot({ path: "test-results/french-home-mobile.png" });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("French product editing, variants, search and bag work without changing canonical data", async ({
  page,
}) => {
  await login(page);
  let productId: number | undefined;
  let categoryId: number | undefined;
  try {
    const stamp = Date.now();
    const cat = await api(page, "categories", "POST", {
      name: "QA French Category",
      slug: `qa-fr-cat-${stamp}`,
      translations: { fr: { name: "Catégorie française QA" } },
    });
    categoryId = cat.id;
    await page.goto("/admin/products/new");
    await page
      .getByLabel("Nom du produit", { exact: true })
      .fill("QA French Product");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Temporary bilingual test product.");
    await page
      .getByLabel("Catégorie", { exact: true })
      .selectOption(String(categoryId));
    await page.getByLabel("Prix de base", { exact: false }).fill("19.50");
    await page.getByLabel("Stock du produit", { exact: true }).fill("6");
    await page.getByLabel("Publié dans la boutique", { exact: false }).check();
    await page.getByText("Traductions françaises", { exact: true }).click();
    await page
      .getByLabel("Nom — Français", { exact: true })
      .fill("Sérum français QA");
    await page
      .getByLabel("Description — Français", { exact: true })
      .fill("Une description française de démonstration.");
    await page
      .getByRole("combobox", { name: "Langue", exact: true })
      .selectOption("en");
    await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
      "QA French Product",
    );
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("fr");
    await page
      .getByRole("button", { name: "Enregistrer le produit", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
    productId = Number(page.url().split("/").pop());
    const product = await api(page, `products/${productId}`);
    expect(product.name).toBe("QA French Product");
    expect(product.translations.fr.name).toBe("Sérum français QA");
    await api(page, "variants", "POST", {
      product: productId,
      name: "Petal",
      sku: `QA-FR-${stamp}-a`,
      stock: 3,
      translations: { fr: { name: "Pétale" } },
    });
    await api(page, "variants", "POST", {
      product: productId,
      name: "Rose",
      sku: `QA-FR-${stamp}-b`,
      stock: 0,
      translations: { fr: { name: "Rose indisponible" } },
    });
    await api(page, "images", "POST", {
      product: productId,
      image_url: "/images/serum.png",
      alt: "QA serum",
      translations: { fr: { alt: "Sérum de démonstration" } },
    });
    await page.goto(
      "/category/all?search=Sérum%20français%20QA&ordering=price",
    );
    await page
      .getByRole("link", { name: "Sérum français QA", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sérum français QA" }),
    ).toBeVisible();
    await expect(
      page.getByText("Une description française de démonstration."),
    ).toBeVisible();
    await expect(page.locator(".detail-price")).toContainText("19,50");
    await expect(
      page.getByRole("button", { name: "Rose indisponible — indisponible" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Pétale", exact: true }).click();
    await page
      .getByRole("button", { name: "Ajouter au panier", exact: false })
      .click();
    const bag = page.getByRole("dialog", { name: "Votre panier beauté" });
    await expect(bag.getByText("Pétale", { exact: true })).toBeVisible();
    await expect(bag.getByText("Sous-total")).toBeVisible();
    await page
      .getByRole("button", { name: "Fermer Votre panier beauté" })
      .click();
    await page
      .getByRole("combobox", { name: "Langue", exact: true })
      .selectOption("en");
    await expect(
      page.getByRole("heading", { name: "QA French Product" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Open shopping bag, 1 items" })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Your beauty bag" })
        .getByText("Petal", { exact: true }),
    ).toBeVisible();
  } finally {
    if (productId) await api(page, `products/${productId}`, "DELETE");
    if (categoryId) await api(page, `categories/${categoryId}`, "DELETE");
  }
});

test("French dashboard accessibility, role values, and native Django language", async ({
  page,
}) => {
  await login(page);
  await page.screenshot({ path: "test-results/french-admin-desktop.png" });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.goto("/admin/staff");
  await page.getByRole("button", { name: "Ajouter un membre" }).click();
  await expect(
    page.getByRole("option", { name: "Éditeur du catalogue" }),
  ).toHaveAttribute("value", "Catalog Editor");
  await expect(
    page.getByRole("option", { name: "Administrateur", exact: true }),
  ).toHaveAttribute("value", "Administrator");
  await page.goto("/admin");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/french-admin-mobile.png" });
  await page.getByRole("button", { name: "Ouvrir la navigation" }).click();
  await page.getByRole("link", { name: "Produits", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Votre collection" }),
  ).toBeVisible();
  const django = await page.request.get("http://127.0.0.1:8000/admin/login/");
  expect(await django.text()).toContain('lang="fr"');
});
