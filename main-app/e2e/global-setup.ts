import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);

  // Fill login form
  const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
  await emailInput.waitFor({ timeout: 15000 });
  await emailInput.fill(process.env.TEST_EMAIL || 'admin@abyte.com');
  await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD || 'admin123');
  await page.keyboard.press('Enter');

  // Wait for navigation away from login page (SPA route change — no real
  // page load event fires, so poll location.href instead of waitForURL)
  await page.waitForFunction(() => !window.location.href.includes('login'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  // Save auth state
  await page.context().storageState({ path: 'auth-state.json' });
  await browser.close();
}

export default globalSetup;
