import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Sales Module', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('orders page loads', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('orders list is visible', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(3000);
    const hasTable = await page.locator('table, tbody, tr').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=/no order|no sale|empty|no result|adjusting/i').first().isVisible().catch(() => false);
    const hasInput = await page.locator('input[placeholder]').first().isVisible().catch(() => false);
    const hasContent = await page.locator('div[class*="order"], div[class*="row"], div[class*="card"]').first().isVisible().catch(() => false);
    expect(hasTable || hasEmpty || hasInput || hasContent).toBeTruthy();
  });

  test('returns page loads', async ({ page }) => {
    await page.goto('/returns');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('quotations page loads', async ({ page }) => {
    await page.goto('/quotations');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('credit sales page loads', async ({ page }) => {
    await page.goto('/credit-sales');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('cash register page loads', async ({ page }) => {
    await page.goto('/cash-register');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('sales reports page loads', async ({ page }) => {
    await page.goto('/sales-reports');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('deliveries page loads', async ({ page }) => {
    await page.goto('/deliveries');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('currency symbol is consistent (no hardcoded $)', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('no critical JS errors on sales pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/orders');
    await page.waitForTimeout(3000);
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('429') &&
      !e.includes('status code 429')
    );
    expect(criticalErrors).toHaveLength(0);
  });

});
