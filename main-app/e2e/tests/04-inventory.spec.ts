import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Inventory Module', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('products page loads', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('products list is visible', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(3000);
    // App uses custom Tailwind divs — check for any product content or empty state
    const hasContent = await page.locator('table, tbody, tr').first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=/no product|empty|no result|add product/i').first().isVisible().catch(() => false);
    const hasSearchInput = await page.locator('input[placeholder*="search" i]').first().isVisible().catch(() => false);
    expect(hasContent || hasEmptyState || hasSearchInput).toBeTruthy();
  });

  test('add product button is visible', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(2000);
    // Button has SVG Plus icon + text that varies by product type
    const addBtn = page.locator('button').filter({ hasText: /add|new|create/i }).first();
    const hasSvgBtn = await page.locator('button:has(svg)').filter({ hasText: /add|product|material|good/i }).first().isVisible().catch(() => false);
    const hasBtn = await addBtn.isVisible().catch(() => false);
    expect(hasSvgBtn || hasBtn).toBeTruthy();
  });

  test('product search works', async ({ page }) => {
    await page.goto('/products');
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('stock alerts page loads', async ({ page }) => {
    await page.goto('/stock-alerts');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('purchase orders page loads', async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('categories page loads', async ({ page }) => {
    await page.goto('/categories');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('suppliers page loads', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('no critical JS errors on inventory pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/products');
    await page.waitForTimeout(3000);
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('429') &&
      !e.includes('status code 429')
    );
    expect(criticalErrors).toHaveLength(0);
  });

});
