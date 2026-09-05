import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('POS — Point of Sale', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('POS page loads', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('product search input is present', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="product" i], input[placeholder*="barcode" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('cart area is visible', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForTimeout(2000);
    const cart = page.locator('text=/cart|order|items/i').first();
    await expect(cart).toBeVisible({ timeout: 5000 });
  });

  test('payment button is present', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForTimeout(2000);
    const payBtn = page.locator('button').filter({ hasText: /pay|checkout|charge/i }).first();
    await expect(payBtn).toBeVisible({ timeout: 5000 });
  });

  test('no JavaScript errors on POS page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/pos');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
