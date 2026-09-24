import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
test('experimental analysis readiness, immutable runs and mobile history', async ({ page, browser }, testInfo) => {
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
  // Request real one-item server pages to exercise both load-more controls without a large browser fixture.
  await page.route('**/analysis/history*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('limit', '1');
    // Keep the browser request lifecycle intact, including cancellation during navigation.
    await route.continue({ url: url.toString() });
  });
  await page.goto(`/org/${org}/analysis`);
  await expect(page.getByRole('heading', { name: 'Advanced Analysis', exact: true })).toBeVisible();
  await page.getByLabel('Baseline first month').fill('2020-01');
  await page.getByLabel('Baseline last month').fill('2020-07');
  await page.getByLabel('Population', { exact: true }).check();
  await page.getByRole('button', { name: 'Check readiness' }).click();
  await expect(page.getByText('Baseline needs attention')).toBeVisible();
  await page.getByLabel('Baseline last month').fill('2020-04');
  await expect(page.getByText('Baseline needs attention')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check readiness' }).click();
  await expect(page.getByText('Inputs ready for experimental fitting')).toBeVisible();
  await page.getByRole('button', { name: 'Save experimental baseline' }).click();
  await expect(page.getByRole('heading', { name: 'Selected baseline · revision 1' })).toBeVisible();
  await page.getByText('Regression diagnostics', { exact: true }).click();
  await expect(page.getByRole('table', { name: 'Model coefficients' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Saved statistical interpretation' })).toContainText(
    'R² verdict: Very strong',
  );
  await expect(page.getByRole('note', { name: 'Saved statistical interpretation' })).toContainText(
    'statistical-interpretation-v1',
  );
  await expect(
    page.getByRole('region', { name: 'Baseline residuals', exact: true }).getByRole('rowheader', { name: '2020-01' }),
  ).toBeVisible();
  await page.getByText('Coefficient covariance', { exact: true }).click();
  await expect(page.getByRole('table', { name: 'Coefficient covariance matrix' })).toBeVisible();
  await page.getByLabel('Reporting first month').fill('2020-05');
  await page.getByLabel('Reporting last month').fill('2020-05');
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Reporting needs attention' })).toBeVisible();
  await page.getByLabel('Outside baseline driver range').selectOption('ALLOW_WITH_WARNING');
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Population is outside the baseline range', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Experimental reporting run saved' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^View run/ })).toHaveCount(1);
  // Save a baseline allowing estimated reporting values; policies are frozen with the baseline.
  await page.getByLabel('Estimated consumption').selectOption('ALLOW_WITH_WARNING');
  await page.getByRole('button', { name: 'Save experimental baseline' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Experimental baseline saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Load older baselines', exact: true }).click();
  await page.getByLabel('Reporting first month').fill('2020-05');
  await page.getByLabel('Reporting last month').fill('2020-06');
  await page.getByLabel('Outside baseline driver range').selectOption('ALLOW_WITH_WARNING');
  await page.getByLabel('Non-routine adjustment').selectOption('HOURS_AND_POPULATION');
  await page
    .getByLabel('NRA rationale and assumptions')
    .fill('Hours and occupancy changed. Selected reference months represent normal operation.');
  await page.getByLabel('NRA evidence references').fill('Test operating-hours and population logs');
  await page.getByLabel('Reference for 2020-05').fill('2020-03');
  await page.getByLabel('Reference for 2020-06').fill('2020-02');
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('form', { name: 'Reporting run' })).toContainText('reference is zero');
  await expect(page.getByRole('button', { name: /^View run/ })).toHaveCount(1);
  await page.getByLabel('Reference for 2020-05').fill('2020-01');
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('heading', { name: 'NRA inputs used in this run' })).toBeVisible();
  const evidence = page.getByRole('region', { name: 'NRA reference inputs' });
  await expect(evidence.getByRole('row')).toHaveCount(5);
  await expect(
    evidence.getByRole('row').filter({ hasText: '2020-05' }).filter({ hasText: 'Operating hours' }),
  ).toContainText('2020-01');
  await expect(
    evidence.getByRole('row').filter({ hasText: '2020-06' }).filter({ hasText: 'Population' }),
  ).toContainText('2020-02');
  const table = page.getByRole('region', { name: 'Monthly reporting results' });
  await expect(table.getByRole('row').filter({ hasText: '2020-05' }).getByRole('cell').nth(2)).toHaveText('10');
  await expect(table.getByRole('row').filter({ hasText: '2020-06' }).getByRole('cell').nth(2)).toHaveText('1.5');
  await expect(page.getByRole('region', { name: 'Reporting results', exact: true })).toContainText(
    'Consumption is estimated.',
  );
  await page.getByRole('button', { name: 'Load older baselines', exact: true }).click();
  await expect(page.getByRole('button', { name: /^View run/ })).toHaveCount(2);
  await page.getByLabel('Significance boundary').selectOption('GREATER_THAN');
  await page.getByRole('button', { name: 'Save reporting run' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Experimental reporting run saved' })).toBeVisible();
  await page.getByRole('button', { name: /^Load older runs for/ }).click();
  await page.getByRole('button', { name: 'Load older baselines', exact: true }).click();
  await expect(page.getByRole('button', { name: /^View run/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Load older runs for/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load older baselines', exact: true })).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath('analysis-desktop.png'), fullPage: true });
  await page.reload();
  await page
    .getByRole('button', { name: /^View run/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  await page.getByText('Regression diagnostics', { exact: true }).click();
  await page.getByText('Coefficient covariance', { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('analysis-mobile.png'), fullPage: true });
  const forbiddenOrigin = await page.request.post(`${base}/sites/${site.id}/analysis/readiness`, {
    headers: { origin: 'https://invalid.example' },
    data: {},
  });
  expect(forbiddenOrigin.status()).toBe(403);
  // Invite a viewer through the local test mail sink and verify both hidden controls and server denial.
  const viewerEmail = `viewer-${randomUUID()}@example.test`;
  await post('/invitations', { email: viewerEmail, role: 'VIEWER', siteIds: [] });
  async function localMailLink(subject: string) {
    let found = '';
    await expect
      .poll(async () => {
        for (const name of await readdir('.local/mail')) {
          const message = JSON.parse(await readFile(`.local/mail/${name}`, 'utf8'));
          if (message.to === viewerEmail && message.subject.includes(subject))
            found = message.text.match(/http:\/\/localhost:3101\/[^\s]+/)?.[0] ?? '';
        }
        return !!found;
      })
      .toBe(true);
    return found;
  }
  const viewerContext = await browser.newContext();
  try {
    const viewer = await viewerContext.newPage();
    viewer.setDefaultTimeout(20_000);
    await viewer.goto(await localMailLink('Join '));
    await expect(viewer).toHaveURL(/\/login\?callbackUrl=/);
    const invitationPath = new URL(viewer.url()).searchParams.get('callbackUrl');
    expect(invitationPath).toMatch(/^\/invite\/[a-f0-9]{64}$/);
    await viewer.getByRole('link', { name: 'Previously used email links? Sign in with an email link.' }).click();
    await expect(viewer.getByRole('heading', { name: 'Sign in with an email link.' })).toBeVisible();
    await expect(viewer.locator('input[name="callbackUrl"]')).toHaveValue(invitationPath!);
    await viewer.getByLabel('Email address').fill(viewerEmail);
    await viewer.getByRole('button', { name: 'Continue with email' }).click();
    await expect(viewer.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
    await viewer.goto(await localMailLink('sign-in link'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(viewer).toHaveURL(new RegExp(`${invitationPath}$`));
    await viewer.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(viewer).toHaveURL(/\/overview$/);
    await viewer.goto(`/org/${org}/analysis`);
    await expect(viewer.getByRole('button', { name: /^View run/ })).toHaveCount(3);
    await expect(viewer.getByRole('button', { name: 'Save experimental baseline' })).toHaveCount(0);
    await viewer
      .getByRole('button', { name: /^View run/ })
      .first()
      .click();
    await expect(viewer.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Save reporting run' })).toHaveCount(0);
    const historyResponse = await viewer.request.get(`${base}/sites/${site.id}/analysis/history`);
    expect(historyResponse.ok()).toBe(true);
    const { items: history } = await historyResponse.json();
    const savedBaseline = await (
      await viewer.request.get(`${base}/sites/${site.id}/analysis/baselines/${history[0].id}`)
    ).json();
    const denied = await viewer.request.post(`${base}/sites/${site.id}/analysis/baselines`, {
      headers: { origin: 'http://localhost:3101' },
      data: savedBaseline.snapshot.definition,
    });
    expect(denied.status()).toBe(403);
    const savedRun = await (
      await viewer.request.get(`${base}/sites/${site.id}/analysis/runs/${history[0].runs[0].id}`)
    ).json();
    const deniedRun = await viewer.request.post(`${base}/sites/${site.id}/analysis/baselines/${history[0].id}/runs`, {
      headers: { origin: 'http://localhost:3101' },
      data: savedRun.snapshot.request,
    });
    expect(deniedRun.status()).toBe(403);
    const memberList = await (await page.request.get(`${base}/members`)).json();
    const member = memberList.find((m: { user: { email: string } }) => m.user.email === viewerEmail);
    expect(
      (
        await page.request.patch(`${base}/members/${member.id}`, {
          headers: { origin: 'http://localhost:3101' },
          data: { role: 'SITE_MANAGER' },
        })
      ).ok(),
    ).toBe(true);
    expect((await viewer.request.get(`${base}/sites/${site.id}/analysis/history`)).status()).toBe(404);
    await viewer.reload();
    await expect(viewer.getByRole('button', { name: /^View run/ })).toHaveCount(0);
    expect(
      (
        await page.request.put(`${base}/members/${member.id}/sites`, {
          headers: { origin: 'http://localhost:3101' },
          data: { siteIds: [site.id] },
        })
      ).ok(),
    ).toBe(true);
    await viewer.reload();
    await expect(viewer.getByRole('button', { name: /^View run/ })).toHaveCount(3);
    await expect(viewer.getByRole('button', { name: 'Save experimental baseline' })).toHaveCount(0);
    // An Analyst can work on models and NRA, while remaining outside organisation administration.
    expect(
      (
        await page.request.patch(`${base}/members/${member.id}`, {
          headers: { origin: 'http://localhost:3101' },
          data: { role: 'ANALYST' },
        })
      ).ok(),
    ).toBe(true);
    await viewer.reload();
    await expect(viewer.getByRole('button', { name: 'Save experimental baseline' })).toBeVisible();
    await expect(viewer.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
    await expect(viewer.getByRole('link', { name: 'Team members', exact: true })).toHaveCount(0);
    expect((await viewer.request.get(`${base}/members`)).status()).toBe(403);
    await viewer.getByLabel('Baseline first month').fill('2020-02');
    await viewer.getByLabel('Baseline last month').fill('2020-04');
    await viewer.getByLabel('Population', { exact: true }).check();
    await viewer.getByRole('button', { name: 'Save experimental baseline' }).click();
    await expect(viewer.getByRole('status').filter({ hasText: 'Experimental baseline saved' })).toBeVisible();
    await viewer.getByLabel('Reporting first month').fill('2020-05');
    await viewer.getByLabel('Reporting last month').fill('2020-05');
    await viewer.getByLabel('Non-routine adjustment').selectOption('POPULATION');
    await viewer
      .getByLabel('NRA rationale and assumptions')
      .fill('Occupancy changed from the baseline reference month.');
    await viewer.getByLabel('NRA evidence references').fill('Test occupancy register');
    await viewer.getByLabel('Reference for 2020-05').fill('2020-02');
    await viewer.getByLabel('Outside baseline driver range').selectOption('ALLOW_WITH_WARNING');
    await viewer.getByRole('button', { name: 'Save reporting run' }).click();
    await expect(viewer.getByRole('heading', { name: 'NRA inputs used in this run' })).toBeVisible();
    await expect(viewer.getByRole('status').filter({ hasText: 'Experimental reporting run saved' })).toBeVisible();
    await page.reload();
    await page
      .getByRole('button', { name: /^View run/ })
      .first()
      .click();
    const reviewPanel = page.getByRole('region', { name: 'NRA review', exact: true });
    await expect(reviewPanel).toContainText('Status: PENDING');
    await page.getByLabel('Review reason').fill('Reference evidence and assumptions reviewed.');
    await page.getByRole('button', { name: 'Record NRA review' }).click();
    await expect(reviewPanel).toContainText('Status: APPROVED');
    await expect(page.getByRole('status').filter({ hasText: 'NRA review recorded' })).toBeVisible();
    await page.reload();
    await page
      .getByRole('button', { name: /^View run/ })
      .first()
      .click();
    await expect(reviewPanel).toContainText('Status: APPROVED');
    await expect(reviewPanel).toContainText('Numerical compatibility remains unvalidated');
    expect(
      (
        await page.request.patch(`${base}/members/${member.id}`, {
          headers: { origin: 'http://localhost:3101' },
          data: { role: 'VIEWER' },
        })
      ).ok(),
    ).toBe(true);
    const demotedWrite = await viewer.request.post(`${base}/sites/${site.id}/analysis/baselines`, {
      headers: { origin: 'http://localhost:3101' },
      data: savedBaseline.snapshot.definition,
    });
    expect(demotedWrite.status()).toBe(403);
    await viewer.reload();
    await expect(viewer.getByRole('button', { name: 'Save experimental baseline' })).toHaveCount(0);
  } finally {
    await viewerContext.close();
  }
  // Frozen input warnings must survive direct save and baseline-only history reads.
  await page.reload();
  await page.getByLabel('Baseline first month').fill('2020-01');
  await page.getByLabel('Baseline last month').fill('2020-06');
  await page.getByLabel('Population', { exact: true }).check();
  await page.getByLabel('Estimated consumption').selectOption('ALLOW_WITH_WARNING');
  await page.getByRole('button', { name: 'Save experimental baseline' }).click();
  const selectedBaseline = page.getByRole('region', { name: 'Selected baseline', exact: true });
  const baselineWarnings = selectedBaseline.getByRole('note', { name: 'Baseline input warnings' });
  await expect(baselineWarnings).toContainText('2020-06: Consumption is estimated.');
  await expect(page.getByRole('status').filter({ hasText: 'Experimental baseline saved' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reporting results', exact: true })).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: /^Load baseline/ })
    .first()
    .click();
  await expect(baselineWarnings).toContainText('2020-06: Consumption is estimated.');
  await expect(page.getByRole('region', { name: 'Reporting results', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Load older baselines', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Load baseline/ })).toHaveCount(2);
  await page
    .getByRole('button', { name: /^Load baseline/ })
    .last()
    .click();
  await expect(selectedBaseline).toContainText('2020-02 – 2020-04');
  await expect(baselineWarnings).toHaveCount(0);
  const archivedBaselineId = (await (await page.request.get(`${base}/sites/${site.id}/analysis/history`)).json())
    .items[0].id;
  expect(
    (await page.request.delete(`${base}/sites/${site.id}`, { headers: { origin: 'http://localhost:3101' } })).ok(),
  ).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Analysis site').getByRole('option', { selected: true })).toContainText('Archived');
  await expect(
    page.getByText('Archived site · Saved baselines and runs are available for review. New calculations are disabled.'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Baseline setup' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save experimental baseline' })).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Load baseline/ })
    .first()
    .click();
  await expect(baselineWarnings).toContainText('2020-06: Consumption is estimated.');
  await expect(page.getByRole('button', { name: 'Save reporting run' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Load older baselines', exact: true }).click();
  await page
    .getByRole('button', { name: /^View run/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Reporting results · experimental' })).toBeVisible();
  expect((await page.request.get(`${base}/sites/${site.id}/analysis/options`)).status()).toBe(404);
  expect(
    (
      await page.request.post(`${base}/sites/${site.id}/analysis/baselines/${archivedBaselineId}/runs`, {
        headers: { origin: 'http://localhost:3101' },
        data: {
          period: { firstMonth: '2020-05', lastMonth: '2020-05' },
          policy: {
            version: 'archive-test',
            nra: 'NONE',
            significanceBasis: 'POST_NRA',
            comparison: 'AT_LEAST',
            sigmaMultiplier: 2,
            zeroThreshold: 'UNDEFINED',
            negativePrediction: 'BLOCK',
            extrapolation: 'BLOCK',
          },
          references: [],
        },
      })
    ).status(),
  ).toBe(404);
  expect(errors).toEqual([]);
});
