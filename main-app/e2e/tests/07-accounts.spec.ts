import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Accounts Module', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('chart of accounts loads', async ({ page }) => {
    await page.goto('/accounts/chart-of-accounts');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('journal entries page loads', async ({ page }) => {
    await page.goto('/accounts/journal-entries');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('payment vouchers page loads', async ({ page }) => {
    await page.goto('/accounts/payment-vouchers');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('receipt vouchers page loads', async ({ page }) => {
    await page.goto('/accounts/receipt-vouchers');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('trial balance page loads', async ({ page }) => {
    await page.goto('/accounts/trial-balance');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('profit and loss page loads', async ({ page }) => {
    await page.goto('/accounts/profit-loss');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('bank accounts page loads', async ({ page }) => {
    await page.goto('/accounts/bank-accounts');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('delete in accounts uses custom confirm dialog (not native)', async ({ page }) => {
    await page.goto('/accounts/bank-accounts');
    await page.waitForTimeout(2000);
    const deleteBtn = page.locator('button').filter({ hasText: /delete/i }).first();
    if (await deleteBtn.isVisible()) {
      // Listen for native dialog — should NOT appear
      let nativeDialogShown = false;
      page.on('dialog', () => { nativeDialogShown = true; });
      await deleteBtn.click();
      await page.waitForTimeout(500);
      expect(nativeDialogShown).toBe(false);
      // Custom modal should be visible
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="confirm"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 });
    }
  });

  test('no JS errors on accounts pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/accounts/chart-of-accounts');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
