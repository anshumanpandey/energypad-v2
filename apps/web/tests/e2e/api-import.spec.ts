import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { apiImportExample } from '../../src/domain/api-import';

test('saved JSON endpoint, example modal, validation and reviewed database import', async ({ page }) => {
  const fixture = JSON.parse(await readFile('.local/e2e-report-schedules.json', 'utf8'));
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: fixture.sessionToken,
      url: 'http://localhost:3101',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const headers = { origin: 'http://localhost:3101' };
  const orgResponse = await page.request.post('/api/v1/organisations', {
    headers,
    data: { name: 'API import workspace', currency: 'GBP', timezone: 'UTC' },
  });
  expect(orgResponse.ok()).toBe(true);
  const org = await orgResponse.json();
  const siteResponse = await page.request.post(`/api/v1/organisations/${org.id}/sites`, {
    headers,
    data: { name: 'Example site' },
  });
  expect(siteResponse.ok()).toBe(true);
  const path = `/api/v1/organisations/${org.id}/api-import`;
  expect((await page.request.put(path, { headers, data: { url: 'http://unsafe.example' } })).status()).toBe(400);
  expect(
    (await page.request.get('/api/v1/organisations/00000000-0000-4000-8000-000000000001/api-import')).status(),
  ).toBe(404);
  await page.goto(`/org/${org.id}/energy`);
  await page.getByRole('button', { name: 'View JSON example' }).click();
  const dialog = page.getByRole('dialog', { name: 'Expected API JSON response' });
  await expect(dialog).toContainText('"version": 1');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('API URL', { exact: true }).fill('https://provider.example/energy-data');
  await page.getByRole('button', { name: 'Save API URL', exact: true }).click();
  await expect(page.getByText('API URL saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('API URL', { exact: true })).toHaveValue('https://provider.example/energy-data');
  await page.route('https://provider.example/energy-data', (route) =>
    route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { ...apiImportExample, version: 2 } }),
  );
  await page.getByRole('button', { name: 'Save & fetch data' }).click();
  await expect(page.getByRole('region', { name: 'API data source' }).getByRole('alert')).toContainText('version');
  await page.unroute('https://provider.example/energy-data');
  await page.route('https://provider.example/energy-data', (route) =>
    route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: apiImportExample }),
  );
  await page.getByRole('button', { name: 'Save & fetch data' }).click();
  await expect(page.getByText('Selected workbook: api-data.xlsx')).toBeVisible();
  await page.getByRole('button', { name: 'Validate workbook', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Workbook import preview' });
  await expect(preview.getByRole('cell', { name: 'Ready', exact: true })).toHaveCount(4);
  await page.getByRole('button', { name: 'Import all four sheets', exact: true }).click();
  await expect(preview.getByRole('cell', { name: 'Imported', exact: true })).toHaveCount(4);
  const records = await page.request.get(`/api/v1/organisations/${org.id}/consumption-records`);
  expect(records.ok()).toBe(true);
  expect(await records.text()).toContain('1250');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'View JSON example' }).click();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
