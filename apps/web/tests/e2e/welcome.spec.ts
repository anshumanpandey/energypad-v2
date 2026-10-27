import { test, expect } from '@playwright/test';

test('public overview landing sends every link to login and fits mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace areas' }).getByRole('link')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Settings shortcuts' }).getByRole('link')).toHaveCount(9);
  for (const link of await page.getByRole('link').all()) {
    await expect(link).toHaveAttribute('href', '/login');
    expect(await link.getAttribute('download')).toBeNull();
  }
  await page.screenshot({ path: testInfo.outputPath('landing-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Download Sites template' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('landing-mobile.png'), fullPage: true });
  await page
    .getByRole('navigation', { name: 'Workspace areas' })
    .getByRole('link', { name: 'Analytics', exact: true })
    .click();
  await expect(page).toHaveURL('/login');
});
