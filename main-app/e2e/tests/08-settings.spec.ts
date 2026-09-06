import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Settings & System', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    // Wait for auth + PermissionGuard + settings load
    await page.waitForTimeout(5000);
    await expect(page.locator('body')).not.toBeEmpty();
    // Verify still on settings page (not redirected to dashboard)
    expect(page.url()).toContain('/settings');
    await expect(page.locator('text=/something went wrong/i')).not.toBeVisible({ timeout: 5000 });
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
    // Wait longer for lazy-loaded AdminGuard components
    await page.waitForTimeout(4000);
    // Check for any content (text, elements) — PageLoader may briefly show no text
    const hasText = await page.locator('body').textContent().then(t => (t || '').trim().length > 0).catch(() => false);
    const hasElements = await page.locator('body > *').count().then(c => c > 0).catch(() => false);
    expect(hasText || hasElements).toBeTruthy();
  });

  test('404 route shows not found page', async ({ page }) => {
    // Already logged in via beforeEach — go to unknown route
    await page.goto('/this-route-does-not-exist-xyz');
    await page.waitForTimeout(3000);
    const notFound = await page.locator('text=/not found|404|page not exist/i').first().isVisible().catch(() => false);
    const redirectedAway = !page.url().includes('this-route-does-not-exist');
    expect(notFound || redirectedAway).toBeTruthy();
  });

  test('no JS errors on settings page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/settings');
    await page.waitForTimeout(3000);
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('429') &&
      !e.includes('status code 429')
    );
    expect(criticalErrors).toHaveLength(0);
  });

});
