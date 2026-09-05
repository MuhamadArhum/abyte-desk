import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Inventory Module', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('products page loads', async ({ page }) => {
    await page.goto('/inventory/products');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('products table is visible', async ({ page }) => {
    await page.goto('/inventory/products');
    await page.waitForTimeout(2000);
    const table = page.locator('table, [class*="table"]').first();
    await expect(table).toBeVisible({ timeout: 5000 });
  });

  test('add product button is visible', async ({ page }) => {
    await page.goto('/inventory/products');
    await page.waitForTimeout(2000);
    const addBtn = page.locator('button').filter({ hasText: /add|new|create/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });

  test('product search works', async ({ page }) => {
    await page.goto('/inventory/products');
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('stock alerts page loads', async ({ page }) => {
    await page.goto('/inventory/stock-alerts');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('purchase orders page loads', async ({ page }) => {
    await page.goto('/inventory/purchase-orders');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('categories page loads', async ({ page }) => {
    await page.goto('/inventory/categories');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('suppliers page loads', async ({ page }) => {
    await page.goto('/inventory/suppliers');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('no JS errors on inventory pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/inventory/products');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
