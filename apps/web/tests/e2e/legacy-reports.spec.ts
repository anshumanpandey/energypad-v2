import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('legacy tips and Reports restore menu, catalogue, overview, targets and coverage', async ({ page }, testInfo) => {
  page.setDefaultTimeout(20_000);
  await page.goto('/signup');
  await page.getByLabel('Email address').fill(`legacy-reports-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Browser report password 123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Browser report password 123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Legacy Reports browser', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const site = await post(`${base}/sites`, { name: 'Reports Site' });
  const other = await post(`${base}/sites`, { name: 'Other Site' });
  for (const [code, endUse] of [
    ['H', 'Heating'],
    ['C', 'Cooling'],
  ]) {
    const meter = await post(`${base}/sites/${site.id}/meters`, { code, name: endUse, fuel: 'GAS', unit: 'kWh' });
    await post(`${base}/sites/${site.id}/energy`, {
      meterId: meter.id,
      month: '2020-01',
      quantity: code === 'H' ? '100' : '50',
      endUse,
      netCost: '10',
      currency: 'GBP',
    });
  }
  await post(`${base}/sites/${site.id}/monthly-plans`, {
    kind: 'TARGET',
    month: '2020-01',
    fuel: 'ALL',
    unit: 'kWh',
    energy: '140',
    carbon: '25',
    conversionFactor: '1',
    source: 'Browser target',
    requestKey: randomUUID(),
  });
  await post(`${base}/emission-factors`, {
    fuel: 'GAS',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.5',
    source: 'Browser factor',
    firstDay: '2020-01-01',
    lastDay: '2020-12-31',
  });
  await page.goto(`/org/${org.id}/energy-tips`);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Targets & Monitoring', 'Site Performance', 'Carbon', 'Opportunities'])
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Carbon Footprint', exact: true })).toBeVisible();
  await expect(page.locator('.energy-tip-card')).toHaveCount(42);
  await page.getByLabel('Filter by category').selectOption('Power');
  await expect(page.locator('.energy-tip-card')).toHaveCount(16);
  const image = page.locator('.energy-tip-card img').first();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const tipsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Entire Document', exact: true }).click();
  expect(await readFile((await (await tipsDownload).path())!, 'utf8')).toContain(
    'Turn off unused Air Conditioning Systems',
  );
  await page.screenshot({ path: testInfo.outputPath('energy-tips.png'), fullPage: true });

  await page.goto(`/org/${org.id}/reports?site=${site.id}&year=2020`);
  const filters = page.getByRole('region', { name: 'Reports dashboard filters' });
  await filters.getByLabel('Month', { exact: true }).selectOption('01');
  const overview = page.getByRole('region', { name: 'Reports overview' });
  await expect(overview.getByRole('row')).toHaveCount(3);
  await expect(overview).toContainText('Heating');
  await expect(overview).toContainText('Jan-20');
  await expect(overview).toContainText('Cooling');
  await expect(page.getByRole('heading', { name: 'Number Of Reports', exact: true })).toBeVisible();
  await expect(page.getByText('2020 · Reports this year 1/12 · Missing Report: 11', { exact: true })).toBeVisible();
  await filters.getByLabel('Display', { exact: true }).selectOption('table');
  const comparison = page.getByRole('region', { name: 'Reports target comparison' });
  await expect(comparison).toContainText('150');
  await expect(comparison).toContainText('140');
  await comparison.getByRole('button', { name: 'Carbon (kg)', exact: true }).click();
  await expect(comparison).toContainText('75');
  await expect(comparison).toContainText('25');
  await filters.getByLabel('Display', { exact: true }).selectOption('pie');
  await expect(comparison.getByRole('img', { name: 'Actual monthly distribution', exact: true })).toBeVisible();
  const reportDownload = page.waitForEvent('download');
  await filters.getByRole('button', { name: 'Download Entire Document', exact: true }).click();
  const csv = await readFile((await (await reportDownload).path())!, 'utf8');
  expect(csv).toContain('Heating');
  expect(csv).toContain('Cooling');
  expect(csv).toContain('Target comparison');
  expect(csv).toContain('Number Of Reports');
  await page.screenshot({ path: testInfo.outputPath('reports-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(comparison.getByRole('heading', { name: 'Carbon Emissions vs Target', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reports-mobile.png'), fullPage: true });
  await filters.getByLabel('Site', { exact: true }).selectOption(other.id);
  await expect(page.getByRole('region', { name: 'Reports overview' })).not.toContainText('Heating');
  await expect(page.getByText('No uploaded data for this selection.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
