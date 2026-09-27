import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('owners review retention counts with UTC cutoffs, validation and responsive layout', async ({ page }) => {
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
  const path = `/org/${fixture.organisationId}/import-retention`;
  await page.goto(`/org/${fixture.organisationId}/settings`);
  await page.getByRole('link', { name: 'Review import retention' }).click();
  await expect(page.getByRole('heading', { name: 'Import retention', exact: true })).toBeVisible();
  await expect(page.getByText('Select a cutoff date to load the inventory.')).toBeVisible();
  await page.getByLabel('Created before (UTC)').fill('2020-02-01');
  await page.getByRole('button', { name: 'Review imports' }).click();
  const sites = page.getByRole('region', { name: 'Site imports', exact: true });
  await expect(sites).toBeVisible();
  await expect(sites.locator('.retention-highlight dd')).toHaveText('1');
  await expect(sites.getByText('Review inconsistent records before making retention decisions.')).toBeVisible();
  await sites.getByRole('link', { name: 'Inspect records' }).click();
  const review = page.getByRole('region', { name: 'Inconsistent batch records' });
  await expect(review).toBeVisible();
  await expect(review.locator('.retention-batch')).toHaveCount(50);
  await expect(review).toContainText('READY');
  await expect(review).toContainText('2020-01-02 00:00:00 UTC');
  const detail = await page.request.get(
    `/api/v1/organisations/${fixture.organisationId}/import-inventory/inconsistent?category=sites`,
  );
  expect(detail.status()).toBe(200);
  expect(detail.headers()['cache-control']).toContain('no-store');
  expect((await detail.json()).items).toHaveLength(50);
  await review.getByRole('link', { name: 'Older records' }).click();
  await expect(review.locator('.retention-batch')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('category')).toBe('sites');
  expect(new URL(page.url()).searchParams.get('beforeDate')).toBe('2020-02-01');
  await review.getByRole('link', { name: 'Latest records' }).click();
  await expect(review.locator('.retention-batch')).toHaveCount(50);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Close record review' }).click();
  await expect(review).toHaveCount(0);
  const energy = page.getByRole('region', { name: 'Energy imports', exact: true });
  await expect(energy.locator('.retention-highlight dd')).toHaveText('0');
  await expect(energy).toContainText('No batches');
  await expect(page.getByLabel('Created before (UTC)')).toHaveValue('2020-02-01');
  const exportLink = page.getByRole('link', { name: 'Download inventory JSON' });
  const exportUrl = (await exportLink.getAttribute('href'))!;
  const downloadEvent = page.waitForEvent('download');
  await exportLink.click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.exportVersion).toBe('import-inventory-v1');
  expect(exported.summaries).toHaveLength(7);
  expect(exported.before).toBe('2020-02-01T00:00:00.000Z');
  const response = await page.request.get(exportUrl);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['content-disposition']).toContain('attachment');
  const staleUrl = exportUrl.replace(exported.fingerprint, '0'.repeat(64));
  const stale = await page.request.get(staleUrl);
  expect(stale.status()).toBe(409);
  expect((await stale.json()).code).toBe('STALE_INVENTORY');
  const events = await (
    await page.request.get(
      `/api/v1/organisations/${fixture.organisationId}/audit/history?action=retention.inventory_exported`,
    )
  ).json();
  expect(events.items).toHaveLength(2);
  await page.reload();
  await expect(sites.locator('.retention-highlight dd')).toHaveText('1');
  await page.screenshot({ path: '/tmp/energiepad-retention-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/energiepad-retention-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('Created before (UTC)')).toHaveValue('');
  for (const query of [
    'beforeDate=bad',
    'beforeDate=2020-02-30',
    'beforeDate=2999-01-01',
    'beforeDate=2020-02-01&beforeDate=2020-03-01',
  ]) {
    await page.goto(`${path}?${query}`);
    await expect(page.getByRole('alert').filter({ hasText: /cutoff|future/ })).toBeVisible();
    await expect(page.locator('.retention-card')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Clear', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByLabel('Created before (UTC)')).toHaveValue('');
});

test('viewers cannot open retention inventory or see its data-page link', async ({ page }) => {
  const fixture = JSON.parse(await readFile('.local/e2e-report-schedules.json', 'utf8'));
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(fixture.viewerEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await page.goto(`/org/${fixture.organisationId}/data`);
  await expect(page.getByRole('link', { name: 'Review import retention' })).toHaveCount(0);
  await page.goto(`/org/${fixture.organisationId}/import-retention?beforeDate=2020-02-01`);
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  await expect(page.locator('.retention-card')).toHaveCount(0);
});
