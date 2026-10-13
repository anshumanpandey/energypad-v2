import { test, expect } from './fixtures/isolated-user';
import { apiImportExample, apiDatasets, apiDatasetLabels } from '../../src/domain/api-import';

test('saved JSON endpoint, example modal, validation and reviewed database import', async ({ page }) => {
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
  const source = page.getByRole('region', { name: 'API data source' });
  const tabs = page.getByRole('tablist', { name: 'API datasets' });
  for (const dataset of apiDatasets) {
    await tabs.getByRole('tab', { name: apiDatasetLabels[dataset], exact: true }).click();
    await source.getByLabel('API URL', { exact: true }).fill(`https://provider.example/${dataset}`);
    await source.getByRole('button', { name: 'Save API URL', exact: true }).click();
    await expect(source.getByText('API URL saved.', { exact: true })).toBeVisible();
  }
  await page.reload();
  for (const dataset of apiDatasets) {
    await tabs.getByRole('tab', { name: apiDatasetLabels[dataset], exact: true }).click();
    await expect(source.getByLabel('API URL', { exact: true })).toHaveValue(`https://provider.example/${dataset}`);
    await source.getByRole('button', { name: 'View JSON example' }).click();
    const dialog = page.getByRole('dialog', { name: 'Expected API JSON response' });
    await expect(dialog.locator('code')).toContainText(`"${dataset}"`);
    await expect(dialog.locator('code')).toContainText('"version": 1');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.route(`https://provider.example/${dataset}`, (route) =>
      route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: { version: 1, [dataset]: apiImportExample[dataset] },
      }),
    );
    await source.getByRole('button', { name: 'Save & fetch data' }).click();
    await expect(page.getByText(`Selected workbook: api-${dataset}.xlsx`)).toBeVisible();
    await page.getByRole('button', { name: 'Validate workbook', exact: true }).click();
    const preview = page.getByRole('region', { name: 'Workbook import preview' });
    await expect(preview.getByRole('cell', { name: 'Ready', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: `Import ${dataset} records`, exact: true }).click();
    await expect(preview.getByRole('cell', { name: 'Imported', exact: true })).toHaveCount(1);
  }
  const records = await page.request.get(`/api/v1/organisations/${org.id}/consumption-records`);
  expect(records.ok()).toBe(true);
  expect(await records.text()).toContain('1250');
  await tabs.getByRole('tab', { name: 'Consumption', exact: true }).click();
  await source.getByLabel('API URL', { exact: true }).fill('');
  await source.getByRole('button', { name: 'Save API URL', exact: true }).click();
  await expect(source.getByText('API URL saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(source.getByLabel('API URL', { exact: true })).toHaveValue('');
  await tabs.getByRole('tab', { name: 'Emissions', exact: true }).click();
  await expect(source.getByLabel('API URL', { exact: true })).toHaveValue('https://provider.example/emissions');
  await page.setViewportSize({ width: 390, height: 844 });
  await source.getByRole('button', { name: 'View JSON example' }).click();
  expect(await page.getByRole('dialog').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
