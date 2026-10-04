import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('consumption and emissions menus filter the same data in graph and table views', async ({ page }, testInfo) => {
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
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Utility graphs', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const london = await post(`${base}/sites`, { name: 'London' });
  const leeds = await post(`${base}/sites`, { name: 'Leeds' });
  for (const [site, fuel, month, quantity] of [
    [london, 'GAS', '2025-01', '100'],
    [leeds, 'ELECTRICITY', '2026-02', '0'],
  ] as const) {
    const meter = await post(`${base}/sites/${site.id}/meters`, {
      code: 'MAIN',
      name: 'Main meter',
      fuel,
      unit: 'kWh',
    });
    await post(`${base}/sites/${site.id}/energy`, {
      meterId: meter.id,
      month,
      quantity,
      netCost: '15',
      vatPercent: '20',
      currency: 'GBP',
    });
    if (site.id === london.id) {
      for (const [previousMonth, previousQuantity] of [
        ['2024-10', '40'],
        ['2024-11', '60'],
        ['2024-12', '80'],
      ]) {
        await post(`${base}/sites/${site.id}/energy`, {
          meterId: meter.id,
          month: previousMonth,
          quantity: previousQuantity,
        });
        await post(`${base}/sites/${site.id}/monthly-plans`, {
          kind: 'TARGET',
          month: previousMonth,
          fuel: 'GAS',
          unit: 'kWh',
          energy: '80',
          carbon: '20',
          conversionFactor: '1',
          source: 'Browser target',
          requestKey: randomUUID(),
        });
      }
    }
  }
  await post(`${base}/emission-factors`, {
    fuel: 'GAS',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.5',
    source: 'Browser fixture',
    firstDay: '2024-10-01',
    lastDay: '2025-12-31',
  });
  await page.goto(`/org/${org.id}/consumption`);
  await post(`${base}/sites/${london.id}/monthly-plans`, {
    kind: 'TARGET',
    month: '2025-01',
    fuel: 'GAS',
    unit: 'kWh',
    energy: '80',
    carbon: '25',
    cost: '12',
    grossCost: '14.40',
    currency: 'GBP',
    conversionFactor: '1',
    source: 'Browser target budget',
    requestKey: randomUUID(),
  });
  await page.reload();
  await expect(page.getByLabel('Consumption site', { exact: true })).toHaveValue(leeds.id);
  await expect(
    page.getByLabel('Consumption site', { exact: true }).getByRole('option', { name: 'All sites', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Consumption', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('img', { name: 'Consumption monthly line graph', exact: true })).toBeVisible();
  await page.getByLabel('Consumption site', { exact: true }).selectOption(london.id);
  await page.getByLabel('Consumption year', { exact: true }).selectOption('2025');
  await page.getByLabel('Consumption month', { exact: true }).selectOption('01');
  await page.getByLabel('Consumption fuel type', { exact: true }).selectOption('GAS');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  const table = page.getByRole('region', { name: 'Consumption table', exact: true });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByRole('cell', { name: '100.00', exact: true })).toBeVisible();
  const costTable = page.getByRole('region', { name: 'Actual vs target cost table', exact: true });
  await expect(costTable.getByRole('cell', { name: '15.00 GBP', exact: true })).toBeVisible();
  await expect(costTable.getByRole('cell', { name: '12.00 GBP', exact: true })).toBeVisible();
  await page.getByLabel('Cost basis', { exact: true }).selectOption('gross');
  await expect(costTable.getByRole('cell', { name: '18.00 GBP', exact: true })).toBeVisible();
  await expect(costTable.getByRole('cell', { name: '14.40 GBP', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Graph view', exact: true }).click();
  await expect(page.getByLabel('Consumption year', { exact: true })).toHaveValue('2025');
  const diverging = page.getByRole('img', { name: 'Actual vs target consumption diverging bar graph', exact: true });
  await expect(diverging).toBeVisible();
  await expect(diverging.locator('[data-selected-month="2025-01"]')).toHaveCount(1);
  await expect(diverging.locator('[data-series="actual"][data-value="100"]')).toHaveCount(1);
  await expect(diverging.locator('[data-series="target"][data-value="80"]')).toHaveCount(1);
  await page.getByLabel('Consumption month', { exact: true }).selectOption('02');
  await expect(diverging.locator('[data-selected-month="2025-02"]')).toHaveCount(1);
  await expect(diverging.locator('[data-series="actual"][data-value="100"]')).toHaveCount(1);
  await expect(
    page.getByRole('img', { name: 'Actual vs target cost · GBP monthly bar graph', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Carbon Footprint', exact: true }).click();
  await expect(page.getByLabel('Carbon Footprint site', { exact: true })).toHaveValue(leeds.id);
  await page.getByLabel('Carbon Footprint site', { exact: true }).selectOption(london.id);
  await page.getByLabel('Carbon Footprint year', { exact: true }).selectOption('2025');
  await page.getByLabel('Carbon Footprint month', { exact: true }).selectOption('01');
  await page.getByLabel('Carbon Footprint fuel type', { exact: true }).selectOption('GAS');
  const carbonBars = page.getByRole('img', { name: 'Actual vs target emissions diverging bar graph', exact: true });
  await expect(carbonBars.locator('[data-series="actual"][data-value="50"]')).toHaveCount(1);
  await expect(carbonBars.locator('[data-series="target"][data-value="25"]')).toHaveCount(1);
  const gauge = page.getByRole('img', {
    name: 'Carbon gauge for selected month and previous three months',
    exact: true,
  });
  await expect(gauge.locator('[data-selected-month="2025-01"]').getByText('200.00%', { exact: true })).toBeVisible();
  await expect(gauge.locator('[data-selected-month="2025-01"]')).toHaveCount(1);
  const recent = page.getByRole('region', { name: 'Recent carbon emissions', exact: true });
  await expect(recent).toContainText('Previous three months average: 30.00 kgCO2e');
  await expect(recent.getByText('2024-10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Carbon gauge table', exact: true })
      .getByRole('row')
      .filter({ hasText: '2025-01' })
      .getByText('200.00%', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Recent carbon emissions table', exact: true }).getByRole('row'),
  ).toHaveCount(5);
  await expect(
    page
      .getByRole('region', { name: 'Carbon Footprint table', exact: true })
      .getByRole('cell', { name: '50.00', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await page.getByLabel('Carbon Footprint site', { exact: true }).selectOption(leeds.id);
  await page.getByLabel('Carbon Footprint month', { exact: true }).selectOption('02');
  await expect(
    page.getByRole('region', { name: 'Carbon Footprint table', exact: true }).getByText('Unavailable', { exact: true }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('emissions-table-mobile.png'), fullPage: true });
});
