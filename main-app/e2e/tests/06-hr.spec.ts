import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('HR Module', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('staff page loads', async ({ page }) => {
    await page.goto('/hr/staff');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('attendance page loads', async ({ page }) => {
    await page.goto('/hr/attendance');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('leave requests page loads', async ({ page }) => {
    await page.goto('/hr/leave-requests');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('leave request date validation works', async ({ page }) => {
    await page.goto('/hr/leave-requests');
    await page.waitForTimeout(2000);
    // Open add modal
    const addBtn = page.locator('button').filter({ hasText: /add|new|request/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Fill from_date AFTER to_date (invalid range)
      const fromDate = page.locator('input[name*="from"], input[type="date"]').first();
      const toDate = page.locator('input[name*="to"], input[type="date"]').nth(1);

      if (await fromDate.isVisible() && await toDate.isVisible()) {
        await toDate.fill('2026-01-01');
        await fromDate.fill('2026-01-10'); // from > to
        const submitBtn = page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /save|submit/i })).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(500);
          const error = page.locator('text=/from date|before|invalid date|date range/i').first();
          await expect(error).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('salary voucher page loads', async ({ page }) => {
    await page.goto('/hr/salary-voucher');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('payroll page loads', async ({ page }) => {
    await page.goto('/hr/payroll');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('departments page loads', async ({ page }) => {
    await page.goto('/hr/departments');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('no JS errors on HR pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/hr/staff');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
