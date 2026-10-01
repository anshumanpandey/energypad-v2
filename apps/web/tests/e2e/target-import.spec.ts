import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { targetColumns } from '../../src/domain/target-import';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('Data Targets validates every cell, saves monthly targets and updates existing records', async ({ page }) => {
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
  const org = await post('organisations', { name: 'Targets workbook', currency: 'GBP', timezone: 'UTC' });
  await post(`organisations/${org.id}/sites`, { code: 'site_mit', name: 'Target site' });
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Targets');
  sheet.addRow(targetColumns);
  sheet.addRow(['site_mit', 2023, 'Jan', 'Petrol', 'kWh', -1, { error: '#VALUE!' }]);
  await page.goto(`/org/${org.id}/data`);
  await page.getByRole('tab', { name: 'Targets', exact: true }).click();
  async function upload() {
    await page.getByLabel('Targets workbook').setInputFiles({
      name: 'targets.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'Validate targets', exact: true }).click();
  }
  await upload();
  const errors = page.getByRole('region', { name: 'Failed import cells' });
  await expect(errors).toContainText('Targets!F2');
  await expect(errors).toContainText('Targets!G2');
  await expect(page.getByRole('button', { name: 'Import 1 targets' })).toHaveCount(0);
  sheet.getCell('F2').value = { formula: '100+50', result: 150 };
  sheet.getCell('G2').value = 200;
  await upload();
  await expect(page.getByRole('cell', { name: 'New', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 targets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Targets imported', exact: true })).toBeVisible();
  sheet.getCell('F2').value = 175;
  await upload();
  await expect(page.getByRole('cell', { name: 'Update', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 targets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Targets imported', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Validate targets', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Targets import preview' })).toContainText('1 unchanged');
  await page.goto(`/org/${org.id}/targets`);
  await page.getByLabel('Plan year').fill('2023');
  await expect(page.getByRole('row').filter({ hasText: '175' }).filter({ hasText: 'PETROL' })).toBeVisible();
});
