import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const loginText = readFileSync('../dashboard-access.txt', 'utf8');
async function staff(page: Page, path: string, method = 'GET', data?: unknown) {
  const token = (await (await page.request.get('/api/staff/csrf')).json()).csrfToken;
  const response = await page.request.fetch(`/api/staff/${path}`, { method, data, headers: { 'X-CSRFToken': token, Origin: 'http://127.0.0.1:3000' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}
async function setup(page: Page) {
  await staff(page, 'login', 'POST', { username: loginText.match(/^Username: (.+)$/m)![1].trim(), password: loginText.match(/^Password: (.+)$/m)![1].trim() });
  const categories = await staff(page, 'categories');
  const product = await staff(page, 'products', 'POST', { name: 'QA Checkout Serum', slug: `qa-checkout-${Date.now()}`, category: categories.results[0].id, description: 'Automated checkout test product.', price: '32.00', stock: 4, is_active: true, is_demo: true, translations: { fr: { name: 'Sérum de test QA' } } });
  await staff(page, 'images', 'POST', { product: product.id, image_url: '/images/serum.png', alt: 'QA Checkout Serum' });
  await page.goto(`/products/${product.slug}`);
  await page.getByRole('button', { name: 'Add to Bag', exact: false }).click();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL('/checkout');
  return product;
}
async function fill(page: Page) {
  await page.locator('[name="full_name"]').fill('QA Checkout Customer');
  await page.locator('[name="email"]').fill('qa-checkout@example.test');
  await page.locator('[name="phone"]').fill('+2348001234567');
  await page.locator('[name="address_line1"]').fill('12 Test Street');
  await page.locator('[name="city"]').fill('Lagos');
  await page.locator('[name="country"]').fill('Nigeria');
  await page.locator('[name="notes"]').fill('Automated checkout test. Not a customer order.');
  await page.locator('[name="acknowledged"]').check();
}
async function cleanup(page: Page, productId: number) {
  const orders = await staff(page, 'orders?search=qa-checkout%40example.test&page_size=100');
  for (const order of orders.results) if (order.items.some((i: {product: number}) => i.product === productId) && order.status !== 'cancelled') await staff(page, `orders/${order.id}`, 'PATCH', { status: 'cancelled' });
  await staff(page, `products/${productId}`, 'DELETE');
}

test('English checkout creates an unpaid request and admin confirms and cancels it', async ({ page }) => {
  const product = await setup(page);
  try {
    await fill(page);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))).toEqual([]);
    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: 'test-results/checkout-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Place unpaid order request' }).click();
    await expect(page.getByRole('heading', { name: 'Your request is with us.' })).toBeVisible();
    await expect(page.getByText('Pending confirmation', { exact: true })).toBeVisible();
    await expect(page.getByText('Demo order request — contains illustrative catalog items.')).toBeVisible();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('veloura-bag-v1') || '[]'))).toHaveLength(0);
    expect(await page.evaluate(() => sessionStorage.getItem('veloura-checkout-key'))).toBeNull();
    const reference = (await page.locator('.receipt-details dd').first().innerText()).trim();
    expect((await staff(page, `products/${product.id}`)).stock).toBe(4);
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: `Review order ${reference}`, exact: true }).click();
    await expect(page.getByText('qa-checkout@example.test', { exact: true })).toBeVisible();
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Confirm & reserve stock' }).click();
    await expect(page.getByRole('dialog').getByText('Confirmed — unpaid', { exact: true })).toBeVisible();
    expect((await staff(page, `products/${product.id}`)).stock).toBe(3);
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Cancelled', { exact: true })).toBeVisible();
    expect((await staff(page, `products/${product.id}`)).stock).toBe(4);
  } finally { await cleanup(page, product.id); }
});

test('French mobile checkout keeps details when switching and handles a stale price', async ({ page }) => {
  const product = await setup(page);
  try {
    await fill(page);
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr');
    await expect(page.getByRole('heading', { name: 'Votre rituel se rapproche.' })).toBeVisible();
    await expect(page.getByLabel('Nom complet', { exact: true })).toHaveValue('QA Checkout Customer');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))).toEqual([]);
    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: 'test-results/checkout-french-mobile.png', fullPage: true });
    await staff(page, `products/${product.id}`, 'PATCH', { price: '35.00' });
    await page.getByRole('button', { name: 'Envoyer la demande sans paiement' }).click();
    await expect(page.locator('.checkout-form').getByRole('alert')).toContainText('Votre panier a changé');
    await expect(page.locator('.checkout-summary')).toContainText('35,00');
    await page.getByRole('button', { name: 'Envoyer la demande sans paiement' }).click();
    await expect(page.getByRole('heading', { name: 'Votre demande a bien été reçue.' })).toBeVisible();
    await expect(page.locator('.receipt-details')).toContainText('35,00');
    await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: 'test-results/checkout-confirmation-mobile.png', fullPage: true });
  } finally { await cleanup(page, product.id); }
});

test('empty checkout has a useful return path and anonymous users cannot read orders', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Your bag is waiting for a little beauty.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the collection', exact: true })).toBeVisible();
  expect((await page.request.get('/api/staff/orders')).status()).toBe(403);
  expect((await page.request.post('/api/catalog/checkout', { data: {} })).status()).toBe(403);
});
