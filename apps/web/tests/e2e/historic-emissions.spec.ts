import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { emissionsColumns } from '../../src/domain/historic-emissions';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('Emissions tab reports every failed cell and imports valid site factors once', async ({ page }, testInfo) => {
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
  const org = await post('organisations', { name: 'Emissions browser import', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const site = await post(`${base}/sites`, { code: 'site_mit', name: 'MIT site' });
  await page.goto(`/org/${org.id}/data`);
  await page.getByRole('tab', { name: 'Sites', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Emissions', exact: true })).toBeFocused();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Emissions');
  sheet.addRow(['', ...emissionsColumns.slice(1)]);
  sheet.addRow(['site_mit', 'bad', '13', 'Gas', 'litres', { error: '#VALUE!' }]);
  async function upload() {
    await page.getByLabel('Emissions workbook', { exact: true }).setInputFiles({
      name: 'emissions.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'Validate emissions', exact: true }).click();
  }
  await upload();
  const errors = page.getByRole('region', { name: 'Failed import cells' });
  await expect(errors.getByRole('heading')).toHaveText('Failed cells (4)');
  for (const cell of ['B2', 'C2', 'E2', 'F2']) await expect(errors).toContainText(`Emissions!${cell}`);
  await expect(page.getByRole('button', { name: 'Import emission factors', exact: true })).toHaveCount(0);
  sheet.getCell('B2').value = 2024;
  sheet.getCell('C2').value = 'Jan';
  sheet.getCell('E2').value = 'kWh';
  sheet.getCell('F2').value = { formula: '1/2', result: 0.5 };
  await upload();
  await expect(errors).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Emissions import preview' })).toContainText('1 factors · 1 new');
  await page.screenshot({ path: testInfo.outputPath('emissions-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('emissions-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import emission factors', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Emission factors imported', exact: true })).toBeVisible();
  await upload();
  await expect(page.getByRole('region', { name: 'Emissions import preview' })).toContainText(
    '0 added · 1 already imported',
  );
  const response = await page.request.get(`/api/v1/${base}/emission-factors`);
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ factor: '0.5', site: { code: 'site_mit' } });
  const meter = await post(`${base}/sites/${site.id}/meters`, {
    code: 'GAS',
    name: 'Gas meter',
    fuel: 'GAS',
    unit: 'kWh',
  });
  await post(`${base}/sites/${site.id}/energy`, { meterId: meter.id, month: '2024-01', quantity: '100' });
  await page.goto(`/org/${org.id}/graphs?site=${site.id}&year=2024`);
  const chart = page.getByRole('region', { name: 'Emissions', exact: true });
  await expect(chart).toContainText('1/12 months available');
  await chart.locator('summary').click();
  await expect(chart.getByRole('row').filter({ hasText: '2024-01' }).getByRole('cell').first()).toHaveText('50');
  await expect(chart.getByRole('row').filter({ hasText: '2024-02' })).toContainText('Missing consumption');
});
