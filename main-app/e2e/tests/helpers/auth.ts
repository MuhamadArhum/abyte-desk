import { Page } from '@playwright/test';

export const TEST_USER = {
  company_code: process.env.TEST_COMPANY_CODE || 'DEMO',
  email: process.env.TEST_EMAIL || 'admin@demo.com',
  password: process.env.TEST_PASSWORD || 'Admin@1234',
};

export async function login(page: Page) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]', { timeout: 10000 });

  const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(TEST_USER.email);
  await passwordInput.fill(TEST_USER.password);
  await page.keyboard.press('Enter');

  // Wait for dashboard to load
  await page.waitForURL(/dashboard|\/$/i, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

export async function logout(page: Page) {
  // Click user menu / logout
  const logoutBtn = page.locator('button', { hasText: /logout|sign out/i }).first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
}
