import { test, expect } from './fixtures/isolated-user';
import { randomUUID } from 'node:crypto';

test('manual utility records correct consumption, factors and targets with revision history', async ({
  page,
}, testInfo) => {
  page.setDefaultTimeout(20_000);
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Manual utility records', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const site = await post(`${base}/sites`, { name: 'Records test site' });
  const meter = await post(`${base}/sites/${site.id}/meters`, {
    name: 'Gas main',
    code: 'G1',
    fuel: 'GAS',
    unit: 'kWh',
  });
  await post(`${base}/sites/${site.id}/energy`, {
    meterId: meter.id,
    month: '2025-01',
    quantity: '100',
    netCost: '10',
    vatPercent: '20',
    currency: 'GBP',
  });
  await post(`${base}/emission-factors`, {
    fuel: 'GAS',
    geography: 'GB',
    basis: 'LOCATION_BASED',
    unit: 'kgCO2e/kWh',
    factor: '0.2',
    source: 'Test factor',
    firstDay: '2025-01-01',
    lastDay: '2025-12-31',
  });
  await post(`${base}/sites/${site.id}/monthly-plans`, {
    kind: 'TARGET',
    month: '2025-01',
    fuel: 'GAS',
    unit: 'kWh',
    energy: '80',
    carbon: '16',
    conversionFactor: '1',
    source: 'Test target',
    requestKey: randomUUID(),
  });
  await page.goto(`/org/${org.id}/utility-records`);
  await page.getByLabel('Records year').selectOption('2025');
  const consumption = page.getByRole('region', { name: 'Energy consumption and costs', exact: true });
  const emissions = page.getByRole('region', { name: 'Energy emissions', exact: true });
  const targets = page.getByRole('region', { name: 'Monitoring & targeting', exact: true });
  await expect(consumption).toContainText('100.00');
  await expect(consumption).toContainText('12.00');
  await expect(emissions).toContainText('0.2');
  const form = page.getByRole('form', { name: 'Edit utility record' });
  await consumption.getByRole('button', { name: 'Edit record' }).click();
  await form.getByLabel('Consumption (kWh)', { exact: true }).fill('120');
  await form.getByLabel('Net cost (excluding VAT)', { exact: true }).fill('20');
  await form.getByLabel('Reason for change').fill('Corrected bill');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form).toHaveCount(0);
  await expect(consumption).toContainText('120.00');
  await expect(consumption).toContainText('24.00');
  await emissions.getByRole('button', { name: 'Edit record' }).click();
  await expect(form).toContainText('Shared workspace factor');
  await form.getByLabel('Emission factor (kgCO₂e/kWh)', { exact: true }).fill('0.25');
  await form.getByLabel('Reason for change').fill('Updated source factor');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(emissions).toContainText('0.25');
  await expect(emissions.locator('tbody tr')).toHaveCount(1);
  await targets.getByRole('button', { name: 'Edit record' }).click();
  await form.getByLabel('Energy (kWh)', { exact: true }).fill('90');
  await form.getByLabel('Reason for change').fill('Reviewed monthly target');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(targets).toContainText('90.00');
  await page.reload();
  await page.getByLabel('Records year').selectOption('2025');
  await expect(consumption).toContainText('120.00');
  await expect(emissions).toContainText('0.25');
  await expect(targets).toContainText('90.00');
  const factors = await (await page.request.get(`/api/v1/${base}/emission-factors`)).json();
  expect(factors).toHaveLength(2);
  expect(factors.map((r: { revision: number }) => r.revision).sort()).toEqual([1, 2]);
  await page.screenshot({ path: testInfo.outputPath('utility-records-desktop.png'), fullPage: true });
  await page.getByLabel('Records month').selectOption('02');
  await expect(consumption).toContainText('No records');
  await expect(targets).toContainText('No records');
  await expect(emissions).toContainText('0.25');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('utility-records-mobile.png'), fullPage: true });
});
