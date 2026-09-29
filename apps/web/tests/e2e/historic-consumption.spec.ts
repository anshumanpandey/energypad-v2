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
  await post(`${base}/sites`, { code: 'London', name: 'London' });
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
});
