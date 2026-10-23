import { test, expect } from '@playwright/test';

test('public welcome cards all open login and fit mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to EnergiePad', exact: true })).toBeVisible();
  await expect(page.locator('.welcome-info-copy p')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('welcome-desktop.png'), fullPage: true });
  for (const name of ['Settings', 'Analytics', 'User Management']) {
    const link = page.getByRole('navigation', { name: 'Main options' }).getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', '/login');
    await link.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
    await page.goto('/');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('welcome-mobile.png'), fullPage: true });
});
