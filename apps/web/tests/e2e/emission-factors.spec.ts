import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
test('carbon factors save, reset and retain corrected versions', async ({ page }, testInfo) => {
  expect(
    (
      await page.request.get(
        `/api/v1/organisations/${randomUUID()}/sites/${randomUUID()}/carbon/report?year=2020&geography=GB&basis=LOCATION_BASED`,
      )
    ).status(),
  ).toBe(401);
  await page.goto('/signup');
  await page.getByLabel('Email address').fill(`carbon-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Browser password 123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Browser password 123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Organisation name').fill('Carbon test workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await page.goto(page.url().replace('/overview', '/carbon'));
  await page.getByLabel('Geography code').fill('gb');
  await page.getByLabel('Factor', { exact: true }).fill('0.123456789');
  await page.getByLabel('First day').fill('2020-01-01');
  await page.getByLabel('Last day (inclusive)').fill('2020-12-31');
  await page.getByLabel('Source and methodology reference').fill('Synthetic browser reference');
  await page.getByRole('button', { name: 'Save factor' }).click();
  await expect(page.getByRole('cell', { name: '0.123456789 kgCO2e/kWh' })).toBeVisible();
  await expect(page.getByLabel('Factor', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Correct', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Fuel', exact: true })).toBeDisabled();
  await page.getByLabel('Factor', { exact: true }).fill('0');
  await page.getByLabel('Correction reason').fill('Correct the synthetic example');
  await page.getByRole('button', { name: 'Save factor' }).click();
  await expect(page.getByText('Revision 2 · Current', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '0.123456789 kgCO2e/kWh' })).toHaveCount(0);
  await page.getByLabel('Include superseded versions').check();
  await expect(page.getByText('Revision 1 · Superseded', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Revision 2 · Current', { exact: true })).toBeVisible();
  const orgId = new URL(page.url()).pathname.split('/')[2];
  const base = `/api/v1/organisations/${orgId}`;
  async function post(path: string, data: unknown) {
    const response = await page.request.post(path, { data, headers: { origin: new URL(page.url()).origin } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const site = await post(`${base}/sites`, { code: 'CARBON', name: 'Carbon browser site' });
  const meter = await post(`${base}/sites/${site.id}/meters`, {
    code: 'E',
    name: 'Electricity meter',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  for (let month = 1; month <= 12; month++)
    await post(`${base}/sites/${site.id}/energy`, {
      meterId: meter.id,
      month: `2020-${String(month).padStart(2, '0')}`,
      quantity: '100',
    });
  await page.reload();
  await page.getByRole('combobox', { name: 'Carbon meter', exact: true }).selectOption(meter.id);
  await page.getByLabel('Calculation year').fill('2020');
  await page.getByLabel('Calculation geography').fill('gb');
  await page.getByRole('button', { name: 'Calculate and save' }).click();
  await expect(page.locator('summary').filter({ hasText: 'Electricity meter · 2020 · 0 kgCO2e' })).toBeVisible();
  await page.getByLabel('Calculation year').fill('2021');
  await page.getByRole('button', { name: 'Calculate and save' }).click();
  await expect(page.locator('summary').filter({ hasText: '2021 · Blocked' })).toBeVisible();
  await page.reload();
  await expect(page.locator('summary').filter({ hasText: 'Electricity meter · 2020 · 0 kgCO2e' })).toBeVisible();
  await page.getByLabel('Target name').fill('Annual browser target');
  await page.getByRole('combobox', { name: 'Target meter', exact: true }).selectOption(meter.id);
  await page.getByLabel('Target year').fill('2020');
  await page.getByLabel('Target geography').fill('gb');
  await page.getByLabel('Annual limit (kgCO2e)').fill('0');
  await page.getByLabel('Target source / rationale').fill('Synthetic browser target');
  await page.getByRole('button', { name: 'Save target', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Annual browser target · Revision 1', exact: true })).toBeVisible();
  await expect(page.getByLabel('Target name')).toHaveValue('');
  const savedRuns = await (await page.request.get(`${base}/sites/${site.id}/carbon`)).json();
  const completeRun = savedRuns.find((r: { snapshot: { status: string } }) => r.snapshot.status === 'COMPLETE');
  await page
    .getByRole('combobox', { name: 'Saved calculation for Annual browser target', exact: true })
    .selectOption(completeRun.id);
  await page.getByRole('button', { name: 'Assess target', exact: true }).click();
  await expect(page.getByText('Target met', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Correct target', exact: true }).click();
  await page.getByLabel('Annual limit (kgCO2e)').fill('1');
  await page.getByLabel('Target correction reason').fill('Revise the synthetic limit');
  await page.getByRole('button', { name: 'Save target', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Annual browser target · Revision 2', exact: true })).toBeVisible();
  await page.getByLabel('Show superseded targets').check();
  await expect(page.getByText('Target met', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Show superseded targets').check();
  await expect(page.getByText('Target met', { exact: true })).toBeVisible();
  await page.getByLabel('Summary year').fill('2020');
  await page.getByLabel('Summary geography').fill('gb');
  await page.getByRole('button', { name: 'Check site summary' }).click();
  const summary = page.getByRole('region', { name: 'Carbon summary results' });
  await expect(summary).toContainText('Active-meter sum: 0 kgCO2e');
  await expect(summary).toContainText('1 of 1 active meters ready');
  const siteDownloadPromise = page.waitForEvent('download');
  await summary.getByRole('button', { name: 'Download carbon JSON' }).click();
  const siteDownload = await siteDownloadPromise;
  const siteReport = JSON.parse(await readFile((await siteDownload.path())!, 'utf8'));
  expect(siteReport.reportVersion).toBe('carbon-report-v1');
  expect(siteReport.totalKgCO2e).toBe('0');
  expect(siteReport.evidence).toHaveLength(1);
  expect(siteReport.evidence[0].snapshot.rows).toHaveLength(12);
  const reportUrl = `${base}/sites/${site.id}/carbon/report?year=2020&geography=GB&basis=LOCATION_BASED`;
  const reportResponse = await page.request.get(reportUrl);
  expect(reportResponse.headers()['cache-control']).toBe('no-store');
  expect(reportResponse.headers()['content-disposition']).toContain('attachment;');
  expect((await page.request.get(`${reportUrl}&format=xml`)).status()).toBe(400);

  await page.getByLabel('Summary year').fill('2021');
  await expect(summary).toHaveCount(0);
  await page.getByRole('button', { name: 'Check site summary' }).click();
  await expect(summary).toContainText('BLOCKED');
  await expect(summary).toContainText('Total unavailable');
  const registered = await (await page.request.get(`${base}/emission-factors`)).json();
  const currentFactor = registered.find((f: { revision: number }) => f.revision === 2);
  await post(`${base}/emission-factors/${currentFactor.id}/correct`, {
    factor: {
      fuel: 'ELECTRICITY',
      geography: 'GB',
      basis: 'LOCATION_BASED',
      unit: 'kgCO2e/kWh',
      factor: '0.2',
      source: 'Updated synthetic browser reference',
      firstDay: '2020-01-01',
      lastDay: '2020-12-31',
    },
    reason: 'Check outdated summary detection',
  });
  await page.getByLabel('Summary year').fill('2020');
  await page.getByRole('button', { name: 'Check site summary' }).click();
  await expect(summary).toContainText('OUTDATED');
  await expect(summary).toContainText('Total unavailable');
  const importPanel = page.getByRole('region', { name: 'Carbon workbook imports', exact: true });
  const factorBook = new ExcelJS.Workbook();
  const factorSheet = factorBook.addWorksheet('Emissions');
  factorSheet.addRow(['fuel', 'geography', 'basis', 'unit', 'factor', 'source', 'firstDay', 'lastDay']);
  factorSheet.addRow([
    'GAS',
    'GB',
    'DIRECT',
    'kgCO2e/kWh',
    { formula: '1/5', result: 0.2 },
    'Browser imported factor',
    '2020-01-01',
    '2020-12-31',
  ]);
  factorBook.addWorksheet('Excluded').addRow(['not imported']);
  await importPanel.getByLabel('Carbon workbook', { exact: true }).setInputFiles({
    name: 'factors.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await factorBook.xlsx.writeBuffer()),
  });
  await importPanel.getByLabel('Worksheet name', { exact: false }).fill('Emissions');
  await importPanel.getByRole('button', { name: 'Preview carbon workbook' }).click();
  const preview = importPanel.locator('[aria-label="Carbon import preview"]');
  await expect(preview).toContainText('READY');
  await expect(preview).toContainText('Excluded sheets: Excluded');
  await expect(importPanel.getByRole('button', { name: 'Commit carbon import' })).toBeDisabled();
  await importPanel.getByLabel('I reviewed all rows, units, scope and corrections.').check();
  await importPanel.getByRole('button', { name: 'Commit carbon import' }).click();
  await expect(preview).toContainText('COMMITTED');
  await expect(preview).toContainText('Revision 1');
  await importPanel.getByRole('combobox', { name: 'Carbon import destination', exact: true }).selectOption('targets');
  const targetBook = new ExcelJS.Workbook();
  const targetSheet = targetBook.addWorksheet('Targets');
  targetSheet.addRow(['meterCode', 'year', 'geography', 'basis', 'unit', 'name', 'limitKgCO2e', 'source']);
  targetSheet.addRow([
    'E',
    2023,
    'GB',
    'LOCATION_BASED',
    'kgCO2e',
    'Workbook browser target',
    25,
    'Browser imported target',
  ]);
  await importPanel.getByLabel('Carbon workbook', { exact: true }).setInputFiles({
    name: 'targets.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await targetBook.xlsx.writeBuffer()),
  });
  await importPanel.getByRole('button', { name: 'Preview carbon workbook' }).click();
  await expect(preview).toContainText('READY');
  await importPanel.getByLabel('I reviewed all rows, units, scope and corrections.').check();
  await importPanel.getByRole('button', { name: 'Commit carbon import' }).click();
  await expect(preview).toContainText('COMMITTED');
  await expect(page.getByRole('heading', { name: 'Workbook browser target · Revision 1', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('carbon-factors.png'), fullPage: true });
  await post(`${base}/sites/${site.id}/carbon`, {
    meterId: meter.id,
    year: 2020,
    geography: 'GB',
    basis: 'LOCATION_BASED',
    requestKey: randomUUID(),
  });
  const portfolio = await post(`${base}/portfolios`, { name: 'Browser carbon portfolio' });
  const assignResponse = await page.request.patch(`${base}/sites/${site.id}`, {
    data: { code: 'CARBON', name: 'Carbon browser site', portfolioId: portfolio.id },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(assignResponse.ok(), await assignResponse.text()).toBe(true);
  await page.goto(`/org/${orgId}/portfolio`);
  await page.getByLabel('Portfolio reporting year').fill('2020');
  await page.getByLabel('Portfolio geography').fill('gb');
  await page.getByRole('button', { name: 'Check portfolio carbon', exact: true }).click();
  const portfolioResults = page.getByRole('region', { name: 'Portfolio carbon results' });
  await expect(portfolioResults).toContainText('Included-meter sum: 240 kgCO2e');
  await expect(portfolioResults).toContainText('1 of 1 included sites ready');
  await post(`${base}/sites`, { code: 'GAP', name: 'Site without meters', portfolioId: portfolio.id });
  await page.getByRole('button', { name: 'Check portfolio carbon', exact: true }).click();
  await expect(portfolioResults).toContainText('Total unavailable');
  await expect(portfolioResults).toContainText('1 of 2 included sites ready');
  await expect(portfolioResults).toContainText('No active meters');
  const portfolioDownloadPromise = page.waitForEvent('download');
  await portfolioResults.getByRole('button', { name: 'Download carbon CSV' }).click();
  const portfolioDownload = await portfolioDownloadPromise;
  const portfolioCsv = await readFile((await portfolioDownload.path())!, 'utf8');
  expect(portfolioCsv).toContain('"INCOMPLETE",""');
  expect(portfolioCsv).toContain('Site without meters');
  expect(portfolioCsv).toContain('monthly-exact-factor-v1');
  expect(portfolioCsv).toContain('"MONTH"');

  await page.screenshot({ path: testInfo.outputPath('portfolio-carbon.png'), fullPage: true });
  await page.getByLabel('Portfolio reporting year').fill('2021');
  await expect(portfolioResults).toHaveCount(0);
  await page.goto(`/org/${orgId}/overview?site=${site.id}&year=2020&geography=GB&basis=LOCATION_BASED`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const overview = page.getByRole('region', { name: 'Performance summary' });
  await expect(overview).toContainText('240 kgCO2e');
  await expect(overview).toContainText('12/12 months');
  await expect(overview).toContainText('Verified savings');
  await page.getByLabel('Calendar year').fill('2021');
  await page.getByRole('button', { name: 'Update overview' }).click();
  await expect(overview).toContainText('0/12 months');
  await expect(overview).not.toContainText('240 kgCO2e');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Monthly overview' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('overview-mobile.png'), fullPage: true });
  page.setDefaultTimeout(20_000);
  await page.goto(`/org/${orgId}/site-performance?year=2020`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Site Performance', exact: true })).toBeVisible();
  const ranking = page.getByRole('region', { name: 'Site rankings', exact: true });
  await expect(ranking).toContainText('Carbon browser site');
  await expect(ranking).toContainText('Site without meters');
  await expect(ranking).toContainText('Unranked');
  await page.getByRole('combobox', { name: 'Period', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Compare sites' }).click();
  await expect(ranking).toContainText('Annual target; no monthly allocation');
  await page.getByRole('combobox', { name: 'Rank by', exact: true }).selectOption('netCost');
  await page.getByRole('button', { name: 'Compare sites' }).click();
  await expect(ranking).toContainText('Unranked');
  await page.screenshot({ path: testInfo.outputPath('site-performance-mobile.png'), fullPage: true });
  await page.goto(
    `/org/${orgId}/carbon-trends?scope=site:${site.id}&year=2020&comparisonYear=2019&geography=GB&basis=LOCATION_BASED`,
    { waitUntil: 'domcontentloaded' },
  );
  const trendSummary = page.getByRole('region', { name: 'Carbon trend summary' });
  await expect(trendSummary).toContainText('240 kgCO2e');
  await expect(trendSummary).toContainText('12/12 complete months');
  await expect(page.getByRole('img', { name: 'Monthly carbon comparison chart in kgCO2e' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('carbon-trends-mobile.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Trend scope', exact: true }).selectOption(`portfolio:${portfolio.id}`);
  await page.getByRole('button', { name: 'Compare carbon trends' }).click();
  await expect(trendSummary).toContainText('0/12 complete months');
  await expect(page.getByRole('region', { name: 'Carbon trends by site' })).toContainText('Site without meters');
  await page.getByLabel('Trend geography', { exact: true }).fill('US');
  await page.getByRole('button', { name: 'Compare carbon trends' }).click();
  await expect(page.getByRole('img', { name: 'Monthly carbon comparison chart in kgCO2e' })).toHaveCount(0);
});
