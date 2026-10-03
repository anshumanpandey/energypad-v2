import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('graphs preserve recorded zero, missing coverage, filters and site isolation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const f = JSON.parse(await readFile('.local/e2e-report-schedules.json', 'utf8'));
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: f.sessionToken,
      url: 'http://localhost:3101',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  // Keep chart data out of the shared report workspace used by later specs.
  const created = await page.request.post('/api/v1/organisations', {
    headers: { origin: 'http://localhost:3101' },
    data: { name: 'Isolated graph workspace', currency: 'GBP', timezone: 'UTC' },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const organisation = await created.json();
  const api = `/api/v1/organisations/${organisation.id}`;
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`${api}${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const site = await post('/sites', { code: 'CHART', name: 'Chart test site' });
  const meter = await post(`/sites/${site.id}/meters`, {
    code: 'E',
    name: 'Chart meter',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  await post(`/sites/${site.id}/energy`, { meterId: meter.id, month: '2020-01', quantity: '0' });
  await post(`/sites/${site.id}/energy`, { meterId: meter.id, month: '2020-02', quantity: '100' });
  await post('/emission-factors', {
    fuel: 'ELECTRICITY',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.5',
    source: 'Synthetic chart factor',
    firstDay: '2020-01-01',
    lastDay: '2020-12-31',
  });
  await post(`/sites/${site.id}/monthly-plans`, {
    kind: 'TARGET',
    month: '2020-ALL',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
    energy: '200',
    conversionFactor: '1',
    source: 'Chart target fixture',
    requestKey: randomUUID(),
  });
  const path = `/org/${organisation.id}/graphs`;
  await page.goto(`${path}?site=${site.id}&year=2020`);
  await expect(page.getByRole('link', { name: 'Graphs', exact: true })).toHaveAttribute('aria-current', 'page');
  const consumption = page.getByRole('region', { name: 'Consumption', exact: true });
  await expect(consumption).toContainText('2/12 months available');
  const comparison = page.getByRole('region', { name: 'Consumption vs target', exact: true });
  await expect(comparison.getByRole('listitem')).toHaveCount(12);
  await expect(comparison.locator('.annual-comparison-totals')).toContainText('Unavailable');
  await expect(comparison.locator('.annual-comparison-totals')).toContainText('2400.00 kWh');
  await expect(comparison.getByRole('listitem').first()).toHaveAttribute(
    'aria-label',
    '2020-01: consumption 0.00 kWh; target 200.00 kWh',
  );
  const month = page.getByLabel('Month', { exact: true });
  await expect(month).toHaveValue('01');
  await expect(consumption.locator('.metric-chart-detail')).toContainText('2020-01: 0 kWh');
  const beforeMonthChange = page.url();
  await month.selectOption('02');
  await expect(comparison.locator('[aria-current="true"]')).toHaveAttribute('aria-label', /^2020-02:/);
  for (const title of ['Consumption', 'Emissions', 'Waste & savings']) {
    const chart = page.getByRole('region', { name: title, exact: true });
    await expect(chart.locator('.metric-chart-detail')).toContainText('2020-02:');
    await expect(chart.locator('.metric-chart-point[aria-current="true"]')).toHaveAttribute('aria-label', /^2020-02:/);
  }
  await expect(
    page.getByRole('region', { name: 'Emissions', exact: true }).locator('.metric-chart-detail'),
  ).toContainText('50 kgCO2e');
  await expect(
    page.getByRole('region', { name: 'Waste & savings', exact: true }).locator('.metric-chart-detail'),
  ).toContainText('Unavailable');
  expect(page.url()).toBe(beforeMonthChange);
  await month.selectOption('03');
  await expect(consumption.locator('.metric-chart-detail')).toContainText('2020-03: Unavailable');
  await month.selectOption('01');
  await consumption.locator('.metric-chart-point').nth(1).focus();
  await expect(consumption.locator('.metric-chart-detail')).toContainText('2020-02: 100 kWh');
  await consumption.locator('summary').click();
  const row = (month: string) => consumption.getByRole('row').filter({ hasText: month });
  await expect(row('2020-01').getByRole('cell').first()).toHaveText('0');
  await expect(row('2020-02').getByRole('cell').first()).toHaveText('100');
  await expect(row('2020-03').getByRole('cell').first()).toHaveText('Unavailable');
  const emissions = page.getByRole('region', { name: 'Emissions', exact: true });
  await emissions.locator('summary').click();
  await expect(emissions.getByRole('row').filter({ hasText: '2020-02' }).getByRole('cell').first()).toHaveText('50');
  await expect(page.getByRole('region', { name: 'Waste & savings', exact: true })).toContainText(
    '0/12 months available',
  );
  for (let i = 3; i <= 12; i++)
    await post(`/sites/${site.id}/energy`, {
      meterId: meter.id,
      month: `2020-${String(i).padStart(2, '0')}`,
      quantity: '100',
    });
  await page.reload();
  await expect(comparison.locator('.annual-comparison-totals')).toContainText('1100.00 kWh');
  await expect(comparison.locator('.annual-comparison-totals')).toContainText('2400.00 kWh');
  const left = await comparison.locator('.annual-comparison-actual').first().boundingBox();
  const right = await comparison.locator('.annual-comparison-target').first().boundingBox();
  expect(left!.x + left!.width).toBeLessThan(right!.x);
  await page.screenshot({ path: testInfo.outputPath('graphs-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('graphs-mobile.png'), fullPage: true });
  await page.getByLabel('Calendar year').fill('2021');
  await page.getByRole('button', { name: 'Update charts' }).click();
  await expect(consumption).toContainText('0/12 months available');
  await page.goto(`${path}?site=${site.id}&year=1899`);
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a year' })).toBeVisible();
  await page.goto(`${path}?site=${randomUUID()}&year=2020`);
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  expect(errors).toEqual([]);
});
