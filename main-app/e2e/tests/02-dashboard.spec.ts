import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads without blank screen', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    // No error boundary
    await expect(page.locator('text=/something went wrong|error boundary/i')).not.toBeVisible();
  });

  test('sidebar is visible', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test('KPI cards are visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    // At least one numeric/stat card should be visible
    const cards = page.locator('[class*="card"], [class*="stat"], [class*="kpi"]').or(
      page.locator('div').filter({ hasText: /total|sales|revenue|order/i })
    );
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  test('no JavaScript errors on dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('navigation links in sidebar work', async ({ page }) => {
    await page.goto('/dashboard');
    // Click first nav item that is not dashboard
    const navLinks = page.locator('nav a, aside a').filter({ hasText: /sales|inventory|hr|account/i });
    const count = await navLinks.count();
    if (count > 0) {
      await navLinks.first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

});
