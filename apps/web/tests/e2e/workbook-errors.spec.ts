import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
import { readFile } from 'node:fs/promises';

test('upload shows every failed cell and clears the list after a corrected upload', async ({ page }) => {
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
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Sites');
  sheet.addRow(['Code', 'Name', 'Area', 'Password']);
  for (let i = 0; i < 55; i++) sheet.addRow([`SITE-${i}`, 'Site', { error: '#DIV/0!' }, { error: '#N/A' }]);
  const other = book.addWorksheet('Other');
  other.addRow(['Quantity']);
  other.addRow([{ formula: '1+1' }]);
  await page.goto(`/org/${fixture.organisationId}/data`);
  await page.getByLabel('Excel workbook').setInputFiles({
    name: 'errors.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Upload workbook', exact: true }).click();
  const errors = page.getByRole('region', { name: 'Failed import cells' });
  await expect(errors.getByRole('heading', { name: 'Failed cells (56)' })).toBeVisible();
  await expect(errors.locator('li')).toHaveCount(50);
  await expect(errors).toContainText('Sites!C2');
  await errors.getByRole('button', { name: 'Next errors' }).click();
  await expect(errors.locator('li')).toHaveCount(6);
  await expect(errors).toContainText('Other!A2');
  await expect(errors).toContainText('formula has no saved result');
  await errors.getByRole('button', { name: 'Previous errors' }).click();
  await expect(errors.locator('li')).toHaveCount(50);
  for (let row = 2; row <= 56; row++) sheet.getCell(row, 3).value = { formula: '10*2', result: 20 };
  other.getCell('A2').value = { formula: '1+1', result: 2 };
  await page.getByLabel('Excel workbook').setInputFiles({
    name: 'corrected.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Upload workbook', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Workbook ready' })).toBeVisible();
  await expect(errors).toHaveCount(0);
});
