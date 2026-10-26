import { test, expect } from './fixtures/isolated-user';

test('site directory sorts attributes, filters fuel and preserves site actions', async ({ page }, testInfo) => {
  page.setDefaultTimeout(20_000);
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Site directory', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}/sites`;
  const office = await post(base, {
    name: 'London Office',
    code: 'LONDON',
    type: 'Office',
    town: 'London',
    address: '1 High Street',
    addressLine2: 'Floor 2',
    postCode: 'SW1A 1AA',
    attributes: { effectiveFrom: '2025-01-01', population: '10', floorArea: '1200', weeklyHours: '40' },
  });
  await post(base, {
    name: 'Bristol School',
    code: 'BRISTOL',
    type: 'School',
    town: 'Bristol',
    attributes: { effectiveFrom: '2025-01-01', population: '0', floorArea: '500', weeklyHours: '30' },
  });
  await post(base, { name: 'Unconfigured site', code: 'EMPTY' });
  await post(`${base}/${office.id}/meters`, { name: 'Main gas', code: 'G1', fuel: 'GAS', unit: 'kWh' });
  await page.goto(`/org/${org.id}/sites`);
  const table = page.getByRole('region', { name: 'Sites table', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.locator('tbody tr').first()).toContainText('London Office');
  await expect(table.locator('tbody tr').first()).toContainText('Floor 2');
  await page.getByRole('radio', { name: 'Town', exact: true }).check();
  await expect(table.locator('tbody tr').first()).toContainText('Bristol School');
  await page.getByRole('radio', { name: 'Population', exact: true }).check();
  await expect(table.locator('tbody tr').first()).toContainText('Bristol School');
  await expect(table.locator('tbody tr').first().locator('td').nth(5)).toHaveText('0');
  await page.getByLabel('Fuel', { exact: true }).selectOption('GAS');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('London Office');
  await page.getByLabel('Fuel', { exact: true }).selectOption('');
  await page.screenshot({ path: testInfo.outputPath('sites-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'View site London Office', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'London Office', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Meter', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add new', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New site', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sites-mobile.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive site Unconfigured site', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(2);
});
