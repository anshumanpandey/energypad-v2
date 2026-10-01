import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('saving weather fetches status and updates baseline configurations without resetting the form', async ({
  page,
}) => {
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
    const res = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(res.ok(), await res.text()).toBe(true);
    return res.json();
  }
  const org = await post('organisations', { name: 'Weather save browser test', currency: 'GBP', timezone: 'UTC' });
  const site = await post(`organisations/${org.id}/sites`, { code: 'WEATHER', name: 'Weather site' });
  await post(`organisations/${org.id}/sites/${site.id}/meters`, {
    code: 'GRID',
    name: 'Grid meter',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  const weatherPath = `**/api/v1/organisations/${org.id}/sites/${site.id}/energy/weather`;
  let job: Record<string, unknown> | null = null;
  let failQueue = false;
  let queueCount = 0;
  let releaseQueue!: () => void;
  const queueGate = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  await page.route(`${weatherPath}/enrich`, async (route) => {
    queueCount++;
    if (failQueue) return route.fulfill({ status: 503, json: { title: 'Queue unavailable' } });
    const body = route.request().postDataJSON();
    expect(body.year).toBe(2020);
    job = {
      id: 'test-job',
      configurationId: body.configurationId,
      status: 'QUEUED',
      attempts: 0,
      totalAttempts: 0,
      availableAt: new Date().toISOString(),
      lastError: null,
    };
    await queueGate;
    await route.fulfill({ json: job });
  });
  await page.route(`${weatherPath}?year=2020`, async (route) => {
    const response = await route.fetch({ maxRetries: 2 });
    await route.fulfill({ response, json: { ...(await response.json()), jobs: job ? [job] : [] } });
  });
  await page.goto(`/org/${org.id}/energy`);
  const configuration = page.getByRole('combobox', { name: 'Weather configuration', exact: true });
  await expect(configuration).toBeVisible();
  await page.getByRole('combobox', { name: 'Estimated consumption', exact: true }).selectOption('ALLOW_WITH_WARNING');
  await page.getByLabel('Year', { exact: true }).selectOption('2020');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  const weather = page.getByRole('region', { name: 'Historical weather', exact: true });
  for (const [label, value] of [
    ['Weather latitude', '51.5'],
    ['Weather longitude', '-0.125'],
    ['Weather timezone', 'Europe/London'],
    ['Heating base (°C)', '15'],
    ['Cooling base (°C)', '20'],
    ['Weather settings source', 'Saved browser configuration'],
  ]) {
    await weather.getByLabel(label, { exact: true }).fill(value);
  }
  await weather.getByRole('button', { name: 'Save weather settings', exact: true }).click();
  const loading = weather.getByRole('status').filter({ hasText: 'Fetching weather status for 2020' });
  await expect(loading).toBeVisible();
  releaseQueue();
  await expect(weather.getByText('Queued · Attempt 0/3', { exact: true })).toBeVisible();
  await expect(loading).toBeVisible();
  await expect(configuration.locator('option')).toHaveCount(2);
  const savedId = await weather.getByLabel('Weather settings version').inputValue();
  await configuration.selectOption(savedId);
  await expect(page.getByRole('combobox', { name: 'Estimated consumption', exact: true })).toHaveValue(
    'ALLOW_WITH_WARNING',
  );
  expect(queueCount).toBe(1);
  job = Object.assign({}, job, { status: 'SUCCEEDED' });
  await weather.getByRole('button', { name: 'Refresh weather status', exact: true }).click();
  await expect(loading).toHaveCount(0);
  failQueue = true;
  await weather.getByText('Add a weather settings version', { exact: true }).click();
  await weather.getByLabel('Weather settings source').fill('Second saved configuration');
  await weather.getByRole('button', { name: 'Save weather settings', exact: true }).click();
  await expect(weather.getByRole('alert')).toContainText('Settings saved, but weather fetching could not start');
  await expect(configuration.locator('option')).toHaveCount(3);
  await expect(configuration).toHaveValue(savedId);
  await expect(page.getByRole('combobox', { name: 'Estimated consumption', exact: true })).toHaveValue(
    'ALLOW_WITH_WARNING',
  );
  await expect(weather.getByRole('button', { name: 'Fetch weather for 2020', exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
  await page.getByLabel('Year', { exact: true }).selectOption(String(new Date().getUTCFullYear()));
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await weather.getByText('Add a weather settings version', { exact: true }).click();
  await weather.getByLabel('Weather settings source').fill('Current year settings');
  await weather.getByRole('button', { name: 'Save weather settings', exact: true }).click();
  await expect(weather.getByRole('alert')).toContainText('Select a completed year');
  await expect(configuration.locator('option')).toHaveCount(4);
  expect(queueCount).toBe(2);
});
