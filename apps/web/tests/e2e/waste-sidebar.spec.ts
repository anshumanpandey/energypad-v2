import { test, expect } from './fixtures/isolated-user';

test('wide waste tables do not cover sidebar controls', async ({ page }, testInfo) => {
  page.setDefaultNavigationTimeout(60_000);
  const headers = { origin: 'http://localhost:3101' };
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { headers, data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Waste sidebar', currency: 'GBP', timezone: 'UTC' });
  const base = `organisations/${org.id}`;
  const site = await post(`${base}/sites`, { code: 'SIDEBAR', name: 'Sidebar test site' });
  const meter = await post(`${base}/sites/${site.id}/meters`, {
    code: 'ELEC',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  await post(`${base}/sites/${site.id}/energy`, { meterId: meter.id, month: '2025-01', quantity: '1250' });
  const secondSite = await post(`${base}/sites`, { code: 'SECOND', name: 'Second test site' });
  const secondMeter = await post(`${base}/sites/${secondSite.id}/meters`, {
    code: 'ELEC',
    name: 'Electricity',
    fuel: 'ELECTRICITY',
    unit: 'kWh',
  });
  await post(`${base}/sites/${secondSite.id}/energy`, { meterId: secondMeter.id, month: '2025-01', quantity: '750' });
  await page.route('**/energy/weather/prepare-calculation', (route) =>
    route.fulfill({ status: 422, json: { title: 'Weather unavailable for layout fixture.' } }),
  );
  await page.goto(`/org/${org.id}/waste-savings?site=${site.id}&year=2025`);
  await expect(page.getByLabel('Waste result month', { exact: true })).toHaveValue('01');
  await page.getByRole('radio', { name: 'All Sites', exact: true }).check();
  await expect(page).toHaveURL(/site=all/);
  await expect(page.getByRole('radio', { name: 'All Sites', exact: true })).toBeChecked();
  await page.locator('.waste-meter-summary').click();
  await expect(
    page.getByRole('region', { name: 'Sidebar test site · Electricity calculation details', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Second test site · Electricity calculation details', exact: true }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Sidebar test site', exact: true }).check();
  await expect(page).toHaveURL(new RegExp(`site=${site.id}`));
  await page.locator('.waste-meter-summary').click();

  await page.getByRole('button', { name: 'Gauge', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected month energy gauge', exact: true })).toBeVisible();
  await expect(page.locator('.waste-expandable-chart:visible')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Waste/Savings Gauge', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cost (£)', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Actual consumption vs wastage graph', exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Gauge', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Waste result month', { exact: true }).selectOption('02');
  await expect(
    page.getByRole('img', { name: 'Selected month energy gauge: N/A, Unavailable', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Graph view', exact: true }).click();
  const costPanel = page.getByRole('region', { name: 'Cost (£)', exact: true });
  await expect(costPanel.getByRole('checkbox', { name: 'Include VAT', exact: true })).not.toBeChecked();
  await costPanel.getByRole('checkbox', { name: 'Include VAT', exact: true }).check();
  await expect(costPanel.getByRole('checkbox', { name: 'Include VAT', exact: true })).toBeChecked();
  await costPanel.getByRole('checkbox', { name: 'Include VAT', exact: true }).uncheck();
  await expect(costPanel.getByRole('checkbox', { name: 'Include VAT', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Expand Cost chart', exact: true }).click();
  await expect(page.locator('.waste-expandable-chart:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Collapse Cost chart', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: 'Collapse Cost chart', exact: true }).click();
  await expect(page.locator('.waste-expandable-chart:visible')).toHaveCount(4);
  const meterDetails = page.locator('.waste-meter-details');
  await expect(meterDetails).toHaveCount(1);
  await expect(page.locator('.waste-dashboard-results > :last-child')).toHaveClass(/waste-meter-details/);
  await expect(meterDetails).not.toHaveAttribute('open');
  await meterDetails.locator('.waste-meter-summary').click();
  await expect(meterDetails).toHaveAttribute('open');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Waste and savings monthly results', exact: true })).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Waste & Savings filters' });
  const box = await sidebar.boundingBox();
  expect(box).not.toBeNull();
  for (const panel of await page.locator('.waste-dashboard-results .panel').all()) {
    const bounds = await panel.boundingBox();
    if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(box!.x);
  }
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click({ timeout: 10000 });
  await page.getByLabel('Waste result month', { exact: true }).selectOption('01');
  await page.evaluate(() => window.scrollTo(0, 0));
  const headerBox = await page.locator('.topbar').boundingBox();
  const sidebarTop = await sidebar.boundingBox();
  expect(sidebarTop!.y).toBe(headerBox!.y + headerBox!.height);
  expect(sidebarTop!.x + sidebarTop!.width).toBe(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('right-sidebar.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.y)).toBe(Math.round(sidebarTop!.y - 600));
  expect((await sidebar.boundingBox())!.x).toBe(sidebarTop!.x);
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar).toHaveCSS('position', 'static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const table = page.getByRole('region', { name: 'Electricity monthly data', exact: true });
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
