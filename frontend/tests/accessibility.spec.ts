import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const route of ["/", "/category/all", "/products/rose-veil-lip-color"]) {
  test(`accessible page structure and contrast: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
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
  });
}

test("bag dialog focus is trapped and restored", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Open shopping bag, 0 items",
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
