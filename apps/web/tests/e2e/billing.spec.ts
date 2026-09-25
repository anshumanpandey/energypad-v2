import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('owner sees assigned plan and live site capacity without paid-subscription claims', async ({ page }, testInfo) => {
  page.setDefaultTimeout(20_000);
  await page.goto('/signup');
  await page.getByLabel('Email address').fill(`billing-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Billing browser password 123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Billing browser password 123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
  await page.getByLabel('Organisation name').fill('Billing test workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  const org = page.url().split('/org/')[1].split('/')[0];
  const api = `/api/v1/organisations/${org}`;
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Current plan' })).toContainText('Starter plan');
  await expect(page.getByRole('region', { name: 'Current plan' })).toContainText(
    'does not represent an active paid subscription',
  );
  await expect(page.getByRole('region', { name: 'Active-site usage' })).toContainText('0 / 5');
  const response = await page.request.post(`${api}/sites`, {
    headers: { origin: 'http://localhost:3101' },
    data: { code: 'BILL', name: 'Usage test site' },
  });
  expect(response.ok()).toBe(true);
  const site = await response.json();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Active-site usage' })).toContainText('1 / 5');
  expect((await (await page.request.get(`${api}/billing`)).json()).sites.remaining).toBe(4);
  expect(
    (await page.request.delete(`${api}/sites/${site.id}`, { headers: { origin: 'http://localhost:3101' } })).ok(),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Active-site usage' })).toContainText('0 / 5');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('billing-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`${api}/billing`)).status()).toBe(401);
});
