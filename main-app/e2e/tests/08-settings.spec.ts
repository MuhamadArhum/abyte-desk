import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Settings & System', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible();
  });

  test('users page loads', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('audit log page loads', async ({ page }) => {
    await page.goto('/audit-log');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('backup page loads', async ({ page }) => {
    await page.goto('/backup');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('access control page loads', async ({ page }) => {
    await page.goto('/access-control');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('404 route shows not found page', async ({ page }) => {
    await login(page);
    await page.goto('/this-route-does-not-exist-xyz');
    await page.waitForTimeout(1500);
    const notFound = page.locator('text=/not found|404|page not exist/i').first();
    const redirected = !(await page.url().includes('this-route'));
    expect(await notFound.isVisible().catch(() => false) || redirected).toBeTruthy();
  });

  test('no JS errors on settings page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/settings');
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
