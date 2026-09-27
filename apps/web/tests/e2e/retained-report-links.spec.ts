import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
test('manual retained report links preserve sign-in destination and current access', async ({
  page,
  browser,
  request,
}, testInfo) => {
  page.setDefaultTimeout(20_000);
  const fixture = JSON.parse(await readFile('.local/e2e-report-schedules.json', 'utf8'));
  const reportPath = `/retained-reports/${fixture.organisationId}/${fixture.siteId}/${fixture.archiveId}`;
  await page.goto(reportPath);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(reportPath);
  await page.getByLabel('Email address', { exact: true }).fill(fixture.email);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${reportPath}$`));
  const snapshot = page.getByRole('region', { name: 'Retained report snapshot' });
  await expect(snapshot.getByRole('heading', { name: 'Energy report', exact: true })).toBeVisible();
  await expect(snapshot).toContainText('2020-01 – 2020-12');
  await expect(snapshot).toContainText('requires sign-in and current access');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download retained JSON', exact: true }).click();
  const json = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(json.siteId).toBe(fixture.siteId);
  expect(json.family).toBe('energy');
  expect(
    (
      await request.get(
        `/api/v1/organisations/${fixture.organisationId}/sites/${fixture.siteId}/report-archives/${fixture.archiveId}`,
      )
    ).status(),
  ).toBe(401);
  const viewerContext = await browser.newContext();
  try {
    const viewer = await viewerContext.newPage();
    await viewer.goto(reportPath);
    await viewer.getByLabel('Email address', { exact: true }).fill(fixture.viewerEmail);
    await viewer.getByLabel('Password', { exact: true }).fill(fixture.password);
    await viewer.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(viewer.getByRole('heading', { name: 'Energy report', exact: true })).toBeVisible();
    const revoke = await page.request.delete(
      `/api/v1/organisations/${fixture.organisationId}/members/${fixture.viewerMembershipId}`,
      { headers: { origin: 'http://localhost:3101' } },
    );
    expect(revoke.ok()).toBe(true);
    await viewer.reload();
    await expect(viewer.getByRole('heading', { name: 'Energy report', exact: true })).toHaveCount(0);
    expect((await viewer.request.get(reportPath)).status()).toBe(404);
  } finally {
    await viewerContext.close();
  }
  expect(
    (
      await page.request.get(`/retained-reports/${fixture.organisationId}/${randomUUID()}/${fixture.archiveId}`)
    ).status(),
  ).toBe(404);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('manual-retained-report-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const freshPreview = await page.request.get(
    `/api/v1/organisations/${fixture.organisationId}/sites/${fixture.siteId}/reports?family=energy&year=2020`,
  );
  const newerArchive = await page.request.post(
    `/api/v1/organisations/${fixture.organisationId}/sites/${fixture.siteId}/report-archives`,
    {
      headers: { origin: 'http://localhost:3101' },
      data: {
        definition: { family: 'energy', year: 2020 },
        fingerprint: freshPreview.headers()['x-report-fingerprint'],
        requestKey: randomUUID(),
      },
    },
  );
  expect(newerArchive.ok()).toBe(true);
  await page.goto(`/org/${fixture.organisationId}/reports`);
  await page.getByRole('button', { name: 'Refresh retained reports', exact: true }).click();
  await expect(page.locator(`a[href="${reportPath}"]`)).toHaveText('Open retained report');
});
