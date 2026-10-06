import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
test('Energy Waste Report guides baseline and reporting steps', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(20_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `analysis-${randomUUID()}@example.test`;
  await page.goto('/login/email');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  let link = '';
  await expect
    .poll(async () => {
      for (const name of await readdir('.local/mail')) {
        const message = JSON.parse(await readFile(`.local/mail/${name}`, 'utf8'));
        if (message.to === email) link = message.text.match(/http:\/\/localhost:3101\/[^\s]+/)?.[0] ?? '';
      }
      return !!link;
    })
    .toBe(true);
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Organisation name').fill('Analysis Browser Test');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  const org = new URL(page.url()).pathname.split('/')[2],
    base = `/api/v1/organisations/${org}`;
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`${base}${path}`, { headers: { origin: 'http://localhost:3101' }, data });
    expect(response.ok()).toBe(true);
    return response.json();
  }
  const site = await post('/sites', { code: 'ANALYSIS', name: 'Analysis Site' });
  const meter = await post(`/sites/${site.id}/meters`, {
    code: 'E',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  for (let i = 1; i <= 12; i++) {
    await post(`/sites/${site.id}/energy`, {
      meterId: meter.id,
      month: `2020-${String(i).padStart(2, '0')}`,
      quantity: String(100 + 2 * i + (i % 2)),
      endUse: 'Heating',
      estimated: false,
    });
    await post(`/sites/${site.id}/energy/drivers`, {
      month: `2020-${String(i).padStart(2, '0')}`,
      driver: 'POPULATION',
      value: String(i),
      source: 'Synthetic browser test',
    });
  }
  for (let i = 1; i <= 12; i++)
    await post(`/sites/${site.id}/energy/drivers`, {
      month: `2020-${String(i).padStart(2, '0')}`,
      driver: 'OPERATING_HOURS',
      value: String(i === 3 ? 0 : i === 5 ? 200 : i === 6 ? 50 : 100),
      source: 'Synthetic operating hours',
    });

  // Leave January missing first to verify annual reporting cannot silently shorten its period.
  for (let i = 2; i <= 12; i++) {
    const month = `2021-${String(i).padStart(2, '0')}`;
    await post(`/sites/${site.id}/energy`, { meterId: meter.id, month, quantity: '120', estimated: false });
    await post(`/sites/${site.id}/energy/drivers`, {
      month,
      driver: 'POPULATION',
      value: '13',
      source: 'Synthetic reporting driver',
    });
  }

  await page.goto(`/org/${org}/energy`);
  const report = page.getByRole('region', { name: 'Waste Report', exact: true });
  await expect(report.getByRole('heading', { name: 'Waste Report', exact: true })).toBeVisible();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toBeDisabled();
  await expect(report.getByRole('button', { name: '3 Results' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2021');
  const automaticPeriod = report.getByRole('note', { name: 'Automatic baseline period' });
  await expect(automaticPeriod).toContainText('01/01/2020 – 31/12/2020');
  await expect(report.getByLabel('Baseline first month')).toHaveCount(0);
  await expect(report.getByLabel('Baseline last month')).toHaveCount(0);
  await expect(report.getByLabel('Population', { exact: true })).toBeHidden();
  await report.getByRole('button', { name: 'Add other drivers', exact: true }).click();
  await report.getByLabel('Population', { exact: true }).check();
  await report.getByRole('button', { name: 'Save experimental baseline' }).click();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toHaveAttribute('aria-current', 'step');
  await expect(automaticPeriod).toBeHidden();
  await report.getByRole('button', { name: 'Back to baseline' }).click();
  await expect(automaticPeriod).toContainText('01/01/2020 – 31/12/2020');
  await report.getByRole('button', { name: '2 Reporting period' }).click();
  await expect(report.getByLabel('Significance boundary')).toHaveCount(0);
  await expect(report.getByLabel('Reporting first month')).toHaveCount(0);
  await expect(report.getByLabel('Reporting last month')).toHaveCount(0);
  await expect(report.getByRole('note', { name: 'Automatic reporting period' })).toContainText(
    '01/01/2021 – 31/12/2021',
  );
  await report.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(report.getByRole('alert').filter({ hasText: 'Reporting needs attention' })).toBeVisible();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toHaveAttribute('aria-current', 'step');
  await post(`/sites/${site.id}/energy`, { meterId: meter.id, month: '2021-01', quantity: '120', estimated: false });
  await post(`/sites/${site.id}/energy/drivers`, {
    month: '2021-01',
    driver: 'POPULATION',
    value: '13',
    source: 'Synthetic reporting driver',
  });
  await report.getByLabel('Outside baseline driver range').selectOption('ALLOW_WITH_WARNING');
  await report.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(report.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  const results = report.getByRole('region', { name: 'Monthly reporting results' });
  await expect(results.getByRole('row')).toHaveCount(13);
  await expect(results.getByRole('rowheader', { name: 'Jan-21', exact: true })).toBeVisible();
  await expect(results.getByRole('rowheader', { name: 'Dec-21', exact: true })).toBeVisible();
  const gas = await post(`/sites/${site.id}/meters`, { code: 'G', name: 'Gas', fuel: 'GAS', unit: 'kWh' });
  await post(`/sites/${site.id}/energy`, { meterId: gas.id, month: '2021-01', quantity: '5', estimated: false });
  const graphPage = await page.context().newPage();
  await graphPage.route('**/energy/weather/prepare-calculation', (route) =>
    route.fulfill({ status: 422, json: { title: 'Test site requires a configured city for weather.' } }),
  );
  await graphPage.goto(`/org/${org}/waste-savings?site=${site.id}`);
  await expect(graphPage.getByRole('region', { name: 'Calculation weather' })).toContainText(
    'Test site requires a configured city for weather.',
  );
  await graphPage.unroute('**/energy/weather/prepare-calculation');
  let prepareCount = 0;
  await graphPage.route('**/energy/weather/prepare-calculation', (route) => {
    prepareCount++;
    return route.fulfill({
      json: {
        configurationId: 'weather-config',
        heatingBase: '15.5',
        coolingBase: '18',
        jobs: [
          { id: 'baseline-weather', year: 2020, status: 'SUCCEEDED' },
          { id: 'reporting-weather', year: 2021, status: 'SUCCEEDED' },
        ],
      },
    });
  });
  await graphPage.route('**/energy/weather?year=*', (route) => {
    const year = new URL(route.request().url()).searchParams.get('year');
    return route.fulfill({
      json: {
        configurations: [],
        results: [],
        jobs: [
          {
            id: year === '2020' ? 'baseline-weather' : 'reporting-weather',
            configurationId: 'weather-config',
            status: 'SUCCEEDED',
            lastError: null,
          },
        ],
      },
    });
  });
  await graphPage.getByRole('button', { name: 'Retry weather fetch', exact: true }).click();
  await expect(graphPage.getByRole('region', { name: 'Calculation weather' })).toContainText(
    'Weather fetched. Recalculating Waste & Savings',
  );
  expect(prepareCount).toBe(1);
  await expect(
    graphPage.getByRole('heading', { name: 'Avoided Energy (+) and Wasted Energy (-) (kWh)', exact: true }),
  ).toBeVisible();
  await expect(graphPage.getByLabel('Waste year')).toHaveValue('2021');
  await expect(
    graphPage.getByRole('heading', { name: 'Avoided Energy (+) and Wasted Energy (-) (kWh)', exact: true }),
  ).toHaveCount(1);
  await expect(graphPage.getByRole('heading', { name: 'Cost (£)', exact: true })).toBeVisible();
  await expect(
    graphPage.getByRole('heading', {
      name: 'Waste/Savings Gauge (Percentage change in the last 3 months)',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    graphPage.getByRole('img', { name: 'Actual consumption vs wastage diverging bar graph', exact: true }),
  ).toBeVisible();
  await expect(graphPage.getByRole('heading', { name: 'Expected consumption', exact: true })).toHaveCount(0);
  await graphPage.getByLabel('Waste year').selectOption('2020');
  await graphPage.getByLabel('Waste fuel type').selectOption('ELECTRICITY');
  await graphPage.getByLabel('Heating', { exact: true }).uncheck();
  await expect(graphPage.getByLabel('Heating', { exact: true })).not.toBeChecked();
  await graphPage.getByLabel('Cooling', { exact: true }).uncheck();
  await expect(graphPage.getByLabel('Cooling', { exact: true })).not.toBeChecked();
  await graphPage.getByRole('button', { name: 'Add other drivers', exact: true }).click();
  await graphPage.getByLabel('Population', { exact: true }).check();
  await expect(graphPage.getByRole('status').filter({ hasText: 'Single routine adjustment' })).toBeVisible();
  await expect(graphPage.getByRole('status').filter({ hasText: '12 of 12 months calculated.' })).toBeVisible();
  await expect(graphPage.getByText('Only one consumption period is available.', { exact: false })).toBeVisible();
  const wasteGaugePanel = graphPage.getByRole('region', { name: 'Waste/Savings Gauge', exact: true });
  await expect(wasteGaugePanel.locator('g[data-month]')).toHaveCount(3);
  await expect(wasteGaugePanel.locator('path')).toHaveCount(0);
  await graphPage.screenshot({ path: testInfo.outputPath('waste-savings-graphs.png'), fullPage: true });
  await graphPage.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(graphPage.getByRole('button', { name: 'Table view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const monthly = graphPage.getByRole('region', { name: 'Waste and savings monthly results', exact: true });
  await expect(monthly).toBeVisible();
  await expect(monthly.getByRole('row')).toHaveCount(13);
  const january = monthly
    .getByRole('row')
    .filter({ has: graphPage.getByRole('rowheader', { name: 'Jan-20', exact: true }) });
  await expect(january.getByRole('cell').nth(0)).toHaveText('103.00');
  await expect(january.getByRole('cell').nth(1)).toHaveText('102.62');
  await expect(january.getByRole('cell').nth(3)).toHaveText('-0.38');
  await graphPage.getByLabel('Waste result month', { exact: true }).selectOption('03');
  await expect(monthly.getByRole('row')).toHaveCount(2);
  await expect(monthly.getByRole('row').nth(1)).toContainText('Mar-20');
  const download = graphPage.waitForEvent('download');
  await graphPage.getByRole('link', { name: 'Download site calculation sheet', exact: true }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toMatch(/^[a-z0-9-]+-2020-single-routine-adjustment\.xlsx$/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await downloaded.path())!);
  expect(book.getWorksheet('Regression Analysis')!.getCell('A1').value).toContain('Single Routine Adjustment');
  let exportedExpected: number | undefined;
  book.getWorksheet('Regression Analysis')!.eachRow((row) => {
    if (row.getCell(1).value === 'Expected consumption (kWh)') exportedExpected = Number(row.getCell(2).result);
  });
  expect(exportedExpected?.toFixed(2)).toBe('102.62');
  const changedFuel = await post(`/sites/${site.id}/meters`, {
    code: 'BIO',
    name: 'Biodiesel heating',
    fuel: 'BIODIESEL',
    unit: 'kWh',
  });
  for (let i = 1; i <= 12; i++)
    await post(`/sites/${site.id}/energy`, {
      meterId: changedFuel.id,
      month: `2020-${String(i).padStart(2, '0')}`,
      quantity: '100',
      endUse: 'Heating',
      netCost: '20',
      currency: 'GBP',
      estimated: false,
    });
  await graphPage.getByRole('button', { name: 'Refresh data', exact: true }).click();
  await graphPage.getByLabel('Waste fuel type').selectOption('BIODIESEL');
  await expect(graphPage.getByText('Only one consumption period is available.', { exact: false })).toBeVisible();
  await expect(graphPage.getByRole('status').filter({ hasText: '12 of 12 months calculated.' })).toBeVisible();
  await graphPage.getByLabel('Waste result month', { exact: true }).selectOption('01');
  const changedJanuary = graphPage
    .getByRole('region', { name: 'Waste and savings monthly results', exact: true })
    .getByRole('row')
    .nth(1);
  await expect(changedJanuary.getByRole('cell').nth(1)).toHaveText('100.00');
  await expect(changedJanuary.getByRole('cell').nth(3)).toHaveText('0.00');
  await expect(changedJanuary.getByRole('cell').nth(4)).toHaveText('0.00');
  await graphPage.close();
  await page.screenshot({ path: testInfo.outputPath('waste-report-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(report.getByRole('button', { name: '3 Results' })).toHaveAttribute('aria-current', 'step');
  await report.getByRole('button', { name: '1 Baseline' }).click();
  await report.getByText('Reuse a saved baseline or reporting run').click();
  await report
    .getByRole('button', { name: /^View run/ })
    .first()
    .click();
  await expect(report.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('waste-report-mobile.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2023');
  await expect(automaticPeriod).toContainText('01/01/2022 – 31/12/2022');
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toBeDisabled();
  await expect(report.getByRole('button', { name: '3 Results' })).toBeDisabled();
  await report.getByRole('button', { name: 'Add other drivers', exact: true }).click();
  await report.getByLabel('Population', { exact: true }).check();
  await report.getByRole('button', { name: 'Check readiness' }).click();
  await expect(report.getByText('Baseline needs attention', { exact: true })).toBeVisible();
  await expect(report.getByRole('status').filter({ hasText: 'Baseline needs attention' })).toContainText('Jan-22');
  expect(errors).toEqual([]);
});
