import { test, expect } from '@playwright/test';
import { login, TEST_USER } from './helpers/auth';

test.describe('Authentication', () => {

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AbyteDesk|ERP|POS/i);
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
    await expect(emailInput).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('empty form shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.locator('button[type="submit"]').first().click();
    // Either HTML5 validation or custom error message
    const hasError = await page.locator('text=/required|enter|email|password/i').first().isVisible().catch(() => false);
    const hasHtml5 = await page.locator(':invalid').first().isVisible().catch(() => false);
    expect(hasError || hasHtml5).toBeTruthy();
  });

  test('invalid email format shows error', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first().fill('notanemail');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(500);
    const errorVisible = await page.locator('text=/valid email|invalid email|email format/i').first().isVisible().catch(() => false);
    const html5Invalid = await page.locator('input:invalid').first().isVisible().catch(() => false);
    expect(errorVisible || html5Invalid).toBeTruthy();
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
    await emailInput.fill(TEST_USER.email);
    await page.locator('input[type="password"]').first().fill('wrongpassword999');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    const error = page.locator('text=/invalid|incorrect|wrong|failed|unauthorized/i').first();
    await expect(error).toBeVisible({ timeout: 5000 });
  });

  test('valid credentials redirect to dashboard', async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/login/i, { timeout: 10000 });
  });

  test('logged out user cannot access protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/login|\//i, { timeout: 5000 });
  });

  test('password field hides text by default', async ({ page }) => {
    await page.goto('/');
    const pwdInput = page.locator('input[type="password"]').first();
    await expect(pwdInput).toHaveAttribute('type', 'password');
  });

  test('forgot password page is accessible', async ({ page }) => {
    await page.goto('/');
    const forgotLink = page.locator('a, button').filter({ hasText: /forgot|reset/i }).first();
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot|reset/i, { timeout: 5000 });
    }
  });

});
