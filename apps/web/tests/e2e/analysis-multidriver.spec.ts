import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

test('saved two/three-driver weather models preserve coefficients, provenance and reporting', async ({ page }) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(20_000);
  const f = JSON.parse(await readFile('.local/e2e-multidriver.json', 'utf8')) as {
    email: string;
    orgId: string;
    siteId: string;
    twoId: string;
    threeId: string;
    configurationId: string;
    weatherId: string;
  };
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login/email');
  await page.getByLabel('Email address').fill(f.email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  let link = '';
  await expect
    .poll(async () => {
      for (const name of await readdir('.local/mail')) {
        const message = JSON.parse(await readFile(`.local/mail/${name}`, 'utf8'));
        if (message.to === f.email) link = message.text.match(/http:\/\/localhost:3101\/[^\s]+/)?.[0] ?? '';
      }
      return !!link;
    })
    .toBe(true);
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const api = `/api/v1/organisations/${f.orgId}/sites/${f.siteId}/analysis`;
  for (const scenario of [
    { meterId: f.twoId, drivers: ['HDD', 'CDD'], expected: 185, actual: 180 },
    { meterId: f.threeId, drivers: ['HDD', 'CDD', 'DAYLIGHT'], expected: 309, actual: 304 },
  ]) {
    await page.goto(`/org/${f.orgId}/analysis`);
    const form = page.getByRole('form', { name: 'Baseline definition' });
    await form.getByLabel('Meter').selectOption(scenario.meterId);
    await page.getByLabel('Baseline first month').fill('2020-01');
    await page.getByLabel('Baseline last month').fill('2020-10');
    await page.getByLabel('Heating degree days', { exact: true }).check();
    await page.getByLabel('Cooling degree days', { exact: true }).check();
    if (scenario.drivers.length === 3) await page.getByLabel('Daylight hours', { exact: true }).check();
    await page.getByLabel('Weather configuration').selectOption(f.configurationId);
    await page.getByRole('button', { name: 'Check readiness' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Baseline needs attention' })).toContainText(
      'Missing, duplicate or incomplete',
    );
    await page.getByLabel('Baseline last month').fill('2020-08');
    await page.getByRole('button', { name: 'Check readiness' }).click();
    await expect(page.getByText('Inputs ready for experimental fitting')).toBeVisible();
    await page.getByRole('button', { name: 'Save experimental baseline' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Experimental baseline saved' })).toBeVisible();
    await page.getByText('Regression diagnostics', { exact: true }).click();
    const coefficients = page.getByRole('table', { name: 'Model coefficients' });
    for (const [code, value] of [
      ['Intercept', '100'],
      ['HDD', '2'],
      ['CDD', '3'],
      ...(scenario.drivers.length === 3 ? [['DAYLIGHT', '4']] : []),
    ])
      await expect(
        coefficients
          .getByRole('row')
          .filter({ has: page.getByRole('rowheader', { name: code, exact: true }) })
          .getByRole('cell')
          .nth(1),
      ).toHaveText(value);
    await page.getByLabel('Reporting first month').fill('2020-10');
    await page.getByLabel('Reporting last month').fill('2020-10');
    await page.getByRole('button', { name: 'Save reporting run' }).click();
    await expect(page.getByRole('form', { name: 'Reporting run' })).toContainText('Missing, duplicate or incomplete');
    await page.getByLabel('Reporting first month').fill('2020-09');
    await page.getByLabel('Reporting last month').fill('2020-09');
    await page.getByRole('button', { name: 'Save reporting run' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Experimental reporting run saved' })).toBeVisible();
    const history = await (await page.request.get(`${api}/history`)).json();
    const runId = history.items[0].runs[0].id;
    const saved = await (await page.request.get(`${api}/runs/${runId}`)).json();
    expect(saved.baseline.fit.coefficients.map((c: { code: string }) => c.code)).toEqual(scenario.drivers);
    expect(saved.baseline.snapshot.assembly.evidence.weather[0]).toMatchObject({
      id: f.weatherId,
      configurationId: f.configurationId,
      inputHash: 'synthetic-pinned-v1',
    });
    expect(saved.snapshot.assembly.evidence.weather[0].id).toBe(f.weatherId);
    expect(saved.result.output.rows[0].expectedKwh).toBeCloseTo(scenario.expected, 9);
    expect(saved.result.output.rows[0].postNraVarianceKwh).toBeCloseTo(5, 9);
    await page.reload();
    await page.getByRole('button', { name: new RegExp(`^View run ${runId.slice(0, 8)}`) }).click();
    const row = page
      .getByRole('region', { name: 'Monthly reporting results' })
      .getByRole('row')
      .filter({ hasText: '2020-09' });
    await expect(row.getByRole('cell').nth(0)).toHaveText(String(scenario.actual));
    await expect(row.getByRole('cell').nth(1)).toHaveText(String(scenario.expected));
    expect(await (await page.request.get(`${api}/runs/${runId}`)).json()).toEqual(saved);
  }
  expect(errors).toEqual([]);
});
