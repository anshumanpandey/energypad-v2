import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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

  await post(`/sites/${site.id}/energy`, { meterId: meter.id, month: '2021-05', quantity: '120', estimated: false });
  await post(`/sites/${site.id}/energy/drivers`, {
    month: '2021-05',
    driver: 'POPULATION',
    value: '13',
    source: 'Synthetic reporting driver',
  });

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
  await report.getByLabel('Population', { exact: true }).check();
  await report.getByRole('button', { name: 'Save experimental baseline' }).click();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toHaveAttribute('aria-current', 'step');
  await expect(automaticPeriod).toBeHidden();
  await report.getByRole('button', { name: 'Back to baseline' }).click();
  await expect(automaticPeriod).toContainText('01/01/2020 – 31/12/2020');
  await report.getByRole('button', { name: '2 Reporting period' }).click();
  await expect(report.getByLabel('Reporting first month')).toHaveValue('01/01/2021');
  await expect(report.getByLabel('Reporting last month')).toHaveValue('31/12/2021');
  await report.getByLabel('Reporting first month').fill('15/05/2021');
  await report.getByLabel('Reporting last month').fill('15/05/2021');
  await report.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(report.getByRole('alert').filter({ hasText: 'Reporting needs attention' })).toBeVisible();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toHaveAttribute('aria-current', 'step');
  await report.getByLabel('Outside baseline driver range').selectOption('ALLOW_WITH_WARNING');
  await report.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(report.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  await expect(report.getByLabel('Reporting first month')).toBeHidden();
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
  await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2022');
  await expect(automaticPeriod).toContainText('01/01/2021 – 31/12/2021');
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toBeDisabled();
  await expect(report.getByRole('button', { name: '3 Results' })).toBeDisabled();
  await report.getByLabel('Population', { exact: true }).check();
  await report.getByRole('button', { name: 'Check readiness' }).click();
  await expect(report.getByText('Baseline needs attention', { exact: true })).toBeVisible();
  await expect(report.getByRole('status').filter({ hasText: 'Baseline needs attention' })).toContainText('2021-01');
  expect(errors).toEqual([]);
});
