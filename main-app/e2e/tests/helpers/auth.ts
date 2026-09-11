import { Page } from '@playwright/test';

export const TEST_USER = {
  email: process.env.TEST_EMAIL || 'admin@abyte.com',
  password: process.env.TEST_PASSWORD || 'admin123',
};

export async function login(page: Page) {
  await page.goto('/');
  // Wait for React to load and potentially redirect unauthenticated users to /login
  await page.waitForTimeout(2000);

  // Check if already authenticated (storageState) by seeing if login form is absent
  const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
  if (!await emailInput.isVisible()) {
    return; // Already authenticated via storageState
  }

  await emailInput.fill(TEST_USER.email);
  await page.locator('input[type="password"]').first().fill(TEST_USER.password);
  await page.keyboard.press('Enter');

  // Wait for navigation away from login (SPA route change — poll location.href)
  await page.waitForFunction(() => !window.location.href.includes('login'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

export async function logout(page: Page) {
  // Click user menu / logout
  const logoutBtn = page.locator('button', { hasText: /logout|sign out/i }).first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
}
