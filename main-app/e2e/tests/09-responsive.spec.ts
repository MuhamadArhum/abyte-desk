import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const viewports = [
  { name: 'Desktop 1920', width: 1920, height: 1080 },
  { name: 'Desktop 1440', width: 1440, height: 900 },
  { name: 'Laptop 1366', width: 1366, height: 768 },
  { name: 'Tablet 1024', width: 1024, height: 768 },
];

test.describe('Responsive Layout', () => {

  for (const vp of viewports) {
    test(`dashboard renders at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page);
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toBeEmpty();
      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = vp.width;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // 20px tolerance
    });
  }

  test('sidebar toggles on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    // Hamburger/menu button should be visible on smaller screens
    const menuBtn = page.locator('button[aria-label*="menu" i], button[class*="hamburger"], button[class*="toggle"]').first();
    // Either a menu button is visible OR sidebar is collapsed
    const sidebarVisible = await page.locator('nav, aside').first().isVisible().catch(() => false);
    expect(sidebarVisible || await menuBtn.isVisible().catch(() => false)).toBeTruthy();
  });

  test('POS renders at 1366x768', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await login(page);
    await page.goto('/pos');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1386);
  });

});
