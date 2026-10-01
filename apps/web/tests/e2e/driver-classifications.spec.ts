import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { classificationColumns } from '../../src/domain/driver-classifications';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('Data Drivers tab validates cell addresses, saves classifications and persists after reload', async ({
  page,
}, testInfo) => {
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
  const org = await post('organisations', { name: 'Drivers import test', currency: 'GBP', timezone: 'UTC' });
  await post(`organisations/${org.id}/sites`, { code: 'LON', name: 'London' });
  await page.goto(`/org/${org.id}/data`);
  await page.getByRole('tab', { name: 'Sites', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Targets', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Drivers', exact: true })).toBeFocused();
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Drivers');
  sheet.getRow(6).values = classificationColumns;
  sheet.getRow(7).values = ['London', 2024, 'bad', { error: '#VALUE!' }, 'NR', 'N/A', 'R', 'N/A'];
  async function upload() {
    await page.getByLabel('Drivers workbook', { exact: true }).setInputFiles({
      name: 'drivers.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
    await page.getByRole('button', { name: 'Validate drivers', exact: true }).click();
  }
  await upload();
  const errors = page.getByRole('region', { name: 'Failed import cells' });
  await expect(errors).toContainText('Drivers!C7');
  await expect(errors).toContainText('Drivers!D7');
  await expect(page.getByRole('button', { name: 'Import drivers', exact: true })).toHaveCount(0);
  sheet.getCell('C7').value = { formula: '"R"', result: 'R' };
  sheet.getCell('D7').value = 'NR';
  await upload();
  await expect(errors).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Driver classification preview' })).toContainText('London (LON)');
  await page.screenshot({ path: testInfo.outputPath('drivers-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('drivers-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Import drivers', exact: true }).click();
  const saved = page.getByRole('region', { name: 'Saved driver classifications', exact: true });
  await expect(saved).toContainText('London (LON)');
  await expect(saved).toContainText('NR · Non-routine');
  await page.reload();
  await page.getByRole('tab', { name: 'Drivers', exact: true }).click();
  await expect(saved.getByRole('row')).toHaveCount(2);
  await expect(saved).toContainText('2024');
  await upload();
  await expect(page.getByRole('region', { name: 'Driver classification preview' })).toContainText('1 already saved');
  await expect(saved.getByRole('row')).toHaveCount(2);
});
