import { test, expect } from './fixtures/isolated-user';

test('overview settings cards navigate to workspace tools and fit mobile', async ({ page }, testInfo) => {
  const response = await page.request.post('/api/v1/organisations', {
    headers: { origin: 'http://localhost:3101' },
    data: { name: 'Overview workspace', currency: 'GBP', timezone: 'UTC' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const org = await response.json();
  const base = `/org/${org.id}`;
  await page.goto(`${base}/overview`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toHaveCount(0);
  await expect(page.locator('.workspace-body')).toHaveCSS('margin-left', '0px');
  const areas = page.getByRole('navigation', { name: 'Workspace areas' });
  await expect(areas.getByRole('link', { name: 'Analytics', exact: true })).toHaveAttribute(
    'href',
    `${base}/overview?area=analytics#overview-settings`,
  );
  await expect(areas.getByRole('link', { name: 'User Management', exact: true })).toHaveAttribute(
    'href',
    `${base}/members`,
  );
  await areas.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page).toHaveURL(`${base}/overview?area=analytics#overview-settings`);
  await expect(areas.getByRole('link', { name: 'Analytics', exact: true })).toHaveAttribute('aria-current', 'true');
  const charts = page.getByRole('navigation', { name: 'Analytics shortcuts' });
  await expect(charts.getByRole('link')).toHaveCount(3);
  for (const [title, section] of [
    ['Consumption', 'consumption'],
    ['Carbon Footprint', 'emissions'],
    ['Waste & Savings', 'waste-savings'],
  ]) {
    await expect(charts.getByRole('link', { name: `View ${title}`, exact: true })).toHaveAttribute(
      'href',
      `${base}/${section}`,
    );
  }
  await page.reload();
  await expect(charts.getByRole('link')).toHaveCount(3);
  await areas.getByRole('link', { name: 'Settings', exact: true }).click();
  const shortcuts = page.getByRole('navigation', { name: 'Settings shortcuts' });
  await expect(shortcuts.getByRole('link')).toHaveCount(9);
  await shortcuts.getByRole('link', { name: 'View Utility & Emissions', exact: true }).click();
  await expect(page).toHaveURL(`${base}/utility-records`);
  await expect(areas).toHaveCount(1);
  await expect(areas.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('aria-current', 'true');
  await areas.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page).toHaveURL(`${base}/consumption`);
  await expect(areas).toHaveCount(0);
  for (const section of ['emissions', 'waste-savings']) {
    await page.goto(`${base}/${section}`);
    await expect(areas).toHaveCount(0);
  }
  await page.goto(`${base}/overview`);
  await areas.getByRole('link', { name: 'User Management', exact: true }).click();
  await expect(page).toHaveURL(`${base}/members`);
  await expect(areas.getByRole('link', { name: 'User Management', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.goto(`${base}/overview`);
  await expect(page.getByRole('link', { name: 'Download Sites template' })).toHaveAttribute(
    'href',
    '/templates/sites.xlsx',
  );
  await expect(page.getByRole('heading', { name: 'Add your first site' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('overview-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('overview-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Upload Sites file', exact: true }).click();
  await expect(page).toHaveURL(`${base}/sites`);
});
