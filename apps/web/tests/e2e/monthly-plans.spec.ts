import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('monthly targets and monitoring save, correct and import all months', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/signup');
  await page.getByLabel('Email address').fill(`plans-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Browser password 123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Browser password 123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Organisation name').fill('Monthly plan test');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  const org = new URL(page.url()).pathname.split('/')[2];
  const response = await page.request.post(`/api/v1/organisations/${org}/sites`, {
    headers: { origin: 'http://localhost:3101' },
    data: { code: 'PLAN', name: 'Plan site' },
  });
  expect(response.ok()).toBe(true);
  await page.goto(`/org/${org}/targets`);
  await page.getByLabel('Plan year', { exact: true }).fill('2020');
  await expect(page.getByLabel('Month or all months')).toHaveValue('2020-01');
  await page.getByLabel('Month or all months').fill('2020-ALL');
  await page.getByLabel('Monthly energy quantity').fill('100');
  await page.getByLabel('Monthly carbon kgCO2e').fill('20');
  await page.getByLabel('Source / conversion reference').fill('Synthetic browser plan');
  await page.getByRole('button', { name: 'Save monthly records' }).click();
  const history = page.getByRole('region', { name: 'Monthly plan history' });
  await expect(history.getByRole('row')).toHaveCount(13);
  await expect(page.getByLabel('Monthly energy quantity')).toHaveValue('');
  await history.getByRole('button', { name: 'Correct', exact: true }).first().click();
  await page.getByLabel('Monthly energy quantity').fill('120');
  await page.getByLabel('Correction reason').fill('Revised January plan');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(history).toContainText('Revision 2 · Current');
  await expect(history).toContainText('Revision 1 · Superseded');
  await page.getByRole('combobox', { name: 'Record kind', exact: true }).selectOption('MONITORING');
  await page.getByLabel('Month or all months').fill('2020-01');
  await page.getByLabel('Monthly energy quantity').fill('90');
  await page.getByLabel('Monthly carbon kgCO2e').fill('0');
  await page.getByLabel('Source / conversion reference').fill('Independent monitoring plan');
  await page.getByRole('button', { name: 'Save monthly records' }).click();
  await expect(history).toContainText('2020-01 · MONITORING');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Monitoring');
  sheet.addRow(['month', 'fuel', 'unit', 'energy', 'carbon', 'conversionFactor', 'source']);
  sheet.addRow(['2021-ALL', 'ELECTRICITY', 'kWh', '50', '0', '1', 'Workbook monthly plan']);
  sheet.getCell('D2').numFmt = '0.00';
  await page.getByRole('combobox', { name: 'Carbon import destination', exact: true }).selectOption('monitoring');
  await page.getByLabel('Carbon workbook', { exact: true }).setInputFiles({
    name: 'monitoring.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Preview carbon workbook' }).click();
  await expect(page.getByText('12 valid rows', { exact: false })).toBeVisible();
  await page.getByLabel('I reviewed all rows, units, scope and corrections.').check();
  await page.getByRole('button', { name: 'Commit carbon import' }).click();
  await expect(page.getByRole('heading', { name: 'Committed row receipt' })).toBeVisible();
  await page.getByLabel('Plan year', { exact: true }).fill('2021');
  await expect(history.getByRole('row')).toHaveCount(13);
  await page.reload();
  await page.getByLabel('Plan year', { exact: true }).fill('2021');
  await expect(history.getByRole('row')).toHaveCount(13);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('monthly-plans-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
