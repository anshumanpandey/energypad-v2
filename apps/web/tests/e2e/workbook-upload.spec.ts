import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { emissionsColumns } from '../../src/domain/historic-emissions';
import { targetColumns } from '../../src/domain/target-import';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');

test('one workbook validates and imports all four sheets with site names', async ({ page }, testInfo) => {
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
  const org = await post('organisations', { name: 'Combined workbook', currency: 'GBP', timezone: 'UTC' });
  await post(`organisations/${org.id}/sites`, { name: 'Main Building' });
  await page.goto(`/org/${org.id}/energy`);
  const download = await page.request.get('/templates/historic-data.xlsx');
  expect(await download.body()).toEqual(await readFile('public/templates/historic-data.xlsx'));
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile('public/templates/historic-data.xlsx');
  // This case exercises the older utility-specific layouts alongside the latest consumption layout.
  book.getWorksheet('Emissions')!.getRow(1).values = emissionsColumns;
  book.getWorksheet('Targets')!.getRow(1).values = targetColumns;
  for (const name of ['Emissions', 'Targets', 'Historic Consumption', 'Drivers']) {
    const sheet = book.getWorksheet(name)!;
    const start = name === 'Drivers' ? 7 : 2;
    for (let row = start; row <= sheet.rowCount; row++) sheet.getRow(row).values = [];
  }
  book.getWorksheet('Emissions')!.getRow(2).values = ['Main Building', 2024, 'Jan', 'Gas', 'kWh', 0.5];
  book.getWorksheet('Targets')!.getRow(2).values = ['Main Building', 2024, 'Jan', 'Gas', 'kWh', -1, 200];
  book.getWorksheet('Drivers')!.getRow(7).values = ['Main Building', 2024, 'R', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
  book.getWorksheet('Historic Consumption')!.getRow(2).values = [
    'Main Building',
    2024,
    'Jan',
    'Heating',
    'Gas',
    45,
    'kWh',
    600,
    60,
    1,
    120,
    9,
  ];
  async function validate() {
    await page.getByLabel('Workbook', { exact: true }).setInputFiles({
      name: 'all-sheets.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'Validate workbook', exact: true }).click();
  }
  await validate();
  await expect(page.getByRole('region', { name: 'Failed import cells' })).toContainText('Targets!F2');
  await expect(page.getByRole('button', { name: 'Import all four sheets', exact: true })).toHaveCount(0);
  book.getWorksheet('Targets')!.getCell('F2').value = 150;
  await validate();
  const preview = page.getByRole('region', { name: 'Workbook import preview' });
  await expect(preview.getByRole('cell', { name: 'Ready', exact: true })).toHaveCount(4);
  const missing = page
    .getByRole('region', { name: 'Workbook upload' })
    .getByRole('region', { name: 'Missing month warnings' });
  await expect(missing).toContainText('33 missing month(s)');
  await missing.getByRole('checkbox', { name: 'I confirm: fill missing months with 0' }).check();
  await expect(page.getByRole('button', { name: 'Import all four sheets', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Validate workbook', exact: true }).click();
  await expect(preview.getByRole('cell', { name: 'Ready', exact: true })).toHaveCount(4);
  await expect(
    preview
      .getByRole('row', { name: /^Historic Consumption/ })
      .getByRole('cell')
      .first(),
  ).toHaveText('12');
  await page.screenshot({ path: testInfo.outputPath('workbook-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('workbook-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import all four sheets', exact: true }).click();
  await expect(preview.getByRole('cell', { name: 'Imported', exact: true })).toHaveCount(4);
  await validate();
  await expect(preview.getByRole('cell', { name: 'Ready', exact: true })).toHaveCount(4);
  for (const row of await preview.locator('tbody tr').all()) await expect(row.getByRole('cell').nth(1)).toHaveText('0');
  await page.getByRole('button', { name: 'Import all four sheets', exact: true }).click();
  await expect(preview.getByRole('cell', { name: 'Imported', exact: true })).toHaveCount(4);
});
