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
  for (let i = 1; i <= 6; i++) {
    await post(`/sites/${site.id}/energy`, {
      meterId: meter.id,
      month: `2020-0${i}`,
      quantity: String(100 + 2 * i + (i % 2)),
      estimated: i === 6,
    });
    await post(`/sites/${site.id}/energy/drivers`, {
      month: `2020-0${i}`,
      driver: 'POPULATION',
      value: String(i),
      source: 'Synthetic browser test',
    });
  }
  for (let i = 1; i <= 6; i++)
    await post(`/sites/${site.id}/energy/drivers`, {
      month: `2020-0${i}`,
      driver: 'OPERATING_HOURS',
      value: String(i === 3 ? 0 : i === 5 ? 200 : i === 6 ? 50 : 100),
      source: 'Synthetic operating hours',
    });

  await page.goto(`/org/${org}/energy`);
  const report = page.getByRole('region', { name: 'Waste Report', exact: true });
  await expect(report.getByRole('heading', { name: 'Waste Report', exact: true })).toBeVisible();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toBeDisabled();
  await expect(report.getByRole('button', { name: '3 Results' })).toBeDisabled();
  const firstDate = report.getByLabel('Baseline first month');
  await expect(firstDate).toHaveAttribute('placeholder', 'DD/MM/YYYY');
  await firstDate.fill('31/02/2020');
  await expect(firstDate).toHaveAttribute('aria-invalid', 'true');
  expect(await firstDate.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  await report.getByRole('button', { name: 'Open calendar' }).first().click();
  await page.keyboard.press('Escape');
  await report.locator('.date-input-calendar').first().fill('2020-01-15');
  await expect(firstDate).toHaveValue('15/01/2020');
  await expect(firstDate).not.toHaveAttribute('aria-invalid', 'true');
  await report.getByLabel('Baseline last month').fill('15/04/2020');
  await report.getByLabel('Population', { exact: true }).check();
  await report.getByRole('button', { name: 'Save experimental baseline' }).click();
  await expect(report.getByRole('button', { name: '2 Reporting period' })).toHaveAttribute('aria-current', 'step');
  await expect(report.getByLabel('Baseline first month')).toBeHidden();
  await report.getByRole('button', { name: 'Back to baseline' }).click();
  await expect(report.getByLabel('Baseline first month')).toHaveValue('15/01/2020');
  await report.getByRole('button', { name: '2 Reporting period' }).click();
  await report.getByLabel('Reporting first month').fill('15/05/2020');
  await report.getByLabel('Reporting last month').fill('15/05/2020');
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
  expect(errors).toEqual([]);
});
