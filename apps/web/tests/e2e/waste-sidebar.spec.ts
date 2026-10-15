import { test, expect } from './fixtures/isolated-user';

test('wide waste tables do not cover sidebar controls', async ({ page }) => {
  page.setDefaultNavigationTimeout(60_000);
  const headers = { origin: 'http://localhost:3101' };
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { headers, data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Waste sidebar', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const site = await post(`${base}/sites`, { code: 'SIDEBAR', name: 'Sidebar test site' });
  const meter = await post(`${base}/sites/${site.id}/meters`, {
    code: 'ELEC',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  await post(`${base}/sites/${site.id}/energy`, { meterId: meter.id, month: '2025-01', quantity: '1250' });
  await page.route('**/energy/weather/prepare-calculation', (route) =>
    route.fulfill({ status: 422, json: { title: 'Weather unavailable for layout fixture.' } }),
  );
  await page.goto(`/org/${org.id}/waste-savings?site=${site.id}&year=2025`);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Waste and savings monthly results', exact: true })).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Waste & Savings filters' });
  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  for (const panel of await page.locator('.waste-dashboard-results .panel').all()) {
    const bounds = await panel.boundingBox();
    if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(box!.x);
  }
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click({ timeout: 10000 });
  await page.getByLabel('Waste result month', { exact: true }).selectOption('01');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const table = page.getByRole('region', { name: 'Electricity monthly data', exact: true });
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
