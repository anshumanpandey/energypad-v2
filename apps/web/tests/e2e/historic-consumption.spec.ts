import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { historicColumns, historicSheet } from '../../src/domain/historic-consumption';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('Data consumption tab validates all cells and imports a corrected workbook', async ({ page }, testInfo) => {
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
    const res = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(res.ok(), await res.text()).toBe(true);
    return res.json();
  }
  const org = await post('organisations', {
    name: 'Historic consumption browser test',
    currency: 'GBP',
    timezone: 'UTC',
  });
  const base = `organisations/${org.id}`;
  const london = await post(`${base}/sites`, { code: 'London', name: 'London' });
  await page.goto(`/org/${org.id}/data`);
  await page.getByRole('tab', { name: 'Consumption', exact: true }).click();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(historicSheet);
  sheet.addRow(historicColumns);
  sheet.addRow(['London', 2020, 'Jan', 'Heating', 'Gas', '', 'invalid', 'kWh', 600, { error: '#DIV/0!' }, 1, 120, 25]);
  async function upload() {
    await page.getByLabel('Consumption workbook').setInputFiles({
      name: 'historic.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'Validate consumption' }).click();
  }
  await upload();
  const errors = page.getByRole('region', { name: 'Failed import cells' });
  await expect(errors.getByRole('heading')).toHaveText('Failed cells (3)');
  for (const cell of ['G2', 'J2', 'M2']) await expect(errors).toContainText(`${historicSheet}!${cell}`);
  sheet.getCell('G2').value = 45;
  sheet.getCell('J2').value = { formula: 'I2/10', result: 60 };
  sheet.getCell('M2').value = 9;
  await upload();
  await expect(errors).toHaveCount(0);
  await expect(page.getByText('1 default meter(s) will be created on import')).toBeVisible();
  await expect(page.getByRole('cell', { name: '540 GBP' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('consumption-import-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('consumption-import.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import 1 readings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 1 consumption' })).toBeVisible();
  await page.getByRole('button', { name: 'Validate consumption' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 1 consumption' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '1 unchanged' })).toBeVisible();
  sheet.getCell('G2').value = 75;
  await upload();
  await expect(page.getByRole('cell', { name: 'Update', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '45 kWh', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '75 kWh', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 readings' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 updated' })).toBeVisible();
  await post(`${base}/sites`, { code: 'Leeds', name: 'Leeds' });
  for (const [utility, quantity] of [
    ['Grid Electricity', 100],
    ['Solar PV', 200],
    ['Petrol', 300],
  ]) {
    sheet.addRow(['London', 2020, 'Jan', 'Heating', utility, '', quantity, 'kWh', 600, 60, 1, 120, 9]);
  }
  sheet.addRow(['London', 2021, 'Jan', 'Heating', 'Gas', '', 800, 'kWh', 600, 60, 1, 120, 9]);
  sheet.addRow(['Leeds', 2020, 'Jan', 'Heating', 'Gas', '', 900, 'kWh', 600, 60, 1, 120, 9]);
  await upload();
  await page.getByRole('button', { name: 'Import 6 readings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 6 consumption' })).toBeVisible();
  const energyPath = `${base}/sites/${london.id}/energy`;
  const existingResponse = await page.request.get(`/api/v1/${energyPath}?year=2020`);
  expect(existingResponse.ok()).toBe(true);
  const existing = await existingResponse.json();
  const gasMeter = existing.meters.find((meter: { fuel: string }) => meter.fuel === 'GAS');
  const archived = await page.request.delete(`/api/v1/${base}/sites/${london.id}/meters/${gasMeter.id}`, {
    headers: { origin: 'http://localhost:3101' },
  });
  expect(archived.ok(), await archived.text()).toBe(true);
  const secondGasMeter = await post(`${base}/sites/${london.id}/meters`, {
    code: 'GAS-2',
    name: 'Second gas meter',
    fuel: 'GAS',
    unit: 'kWh',
  });
  await post(energyPath, { meterId: secondGasMeter.id, month: '2020-01', quantity: '400' });
  await page.goto(`/org/${org.id}/energy`);
  await page.getByLabel('Energy site').selectOption({ label: 'London' });
  await page.getByLabel('Year', { exact: true }).selectOption('2020');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  const records = page.getByRole('region', { name: 'Consumption records', exact: true });
  await expect(records.getByRole('cell').filter({ hasText: /^75/ }).first()).toBeVisible();
  await expect(records.getByRole('row')).toHaveCount(6);
  await expect(records.getByRole('cell', { name: 'Gas', exact: true })).toHaveCount(2);
  for (const utility of ['Grid electricity', 'Solar PV', 'Petrol']) {
    await expect(records.getByRole('cell', { name: utility, exact: true })).toBeVisible();
  }
  for (const quantity of [75, 100, 200, 300, 400]) {
    await expect(records.getByRole('cell', { name: `${quantity} kWh`, exact: true })).toBeVisible();
  }
  await expect(records).toContainText(gasMeter.name);
  await expect(records).toContainText('Second gas meter');
  await page.getByLabel('Energy meter', { exact: true }).selectOption(secondGasMeter.id);
  await expect(records.getByRole('row')).toHaveCount(6);
  const bodyRows = records.locator('tbody tr');
  await expect(bodyRows.locator('td:nth-child(2)')).toHaveText([
    'Gas',
    'Gas',
    'Grid electricity',
    'Petrol',
    'Solar PV',
  ]);
  await records.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(bodyRows.locator('td:nth-child(3)')).toHaveText(['75 kWh', '100 kWh', '200 kWh', '300 kWh', '400 kWh']);
  await records.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(bodyRows.first()).toContainText('400 kWh');
  await expect(records.getByRole('columnheader', { name: 'Source', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await records.getByRole('button', { name: 'Utility', exact: true }).click();
  await records.getByRole('button', { name: 'Utility', exact: true }).click();
  await expect(bodyRows.first().locator('td').nth(1)).toHaveText('Solar PV');
  await records.getByRole('button', { name: 'Energy (kWh)', exact: true }).click();
  await expect(bodyRows.first()).toContainText('75 kWh');
  await records.getByRole('button', { name: 'Net / gross cost', exact: true }).click();
  await expect(bodyRows.last()).toContainText('400 kWh');
  await records.getByRole('button', { name: 'Month / meter', exact: true }).click();
  await expect(records.getByRole('columnheader', { name: 'Month / meter', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await records.getByLabel('Filter consumption month').selectOption('01');
  await records.getByLabel('Filter consumption utility').selectOption('GAS');
  await expect(bodyRows).toHaveCount(2);
  await expect(records.getByText('2 of 5 readings', { exact: true })).toBeVisible();
  await records.getByLabel('Filter consumption month').selectOption('02');
  await expect(records.getByText('No readings match the selected month and utility.')).toBeVisible();
  await records.getByLabel('Filter consumption month').selectOption('01');
  await records.getByLabel('Filter consumption utility').selectOption('SOLAR_PV');
  await expect(bodyRows).toHaveCount(1);
  await expect(bodyRows.first()).toContainText('200 kWh');
  await records.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(bodyRows).toHaveCount(5);
  await records.getByLabel('Filter consumption utility').selectOption('SOLAR_PV');
  await page.getByLabel('Year', { exact: true }).selectOption('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(records.getByLabel('Filter consumption utility')).toHaveValue('');
  await expect(records.getByLabel('Filter consumption month')).toHaveValue('');
  await expect(bodyRows).toHaveCount(1);
  await expect(bodyRows.first()).toContainText('800 kWh');
});
