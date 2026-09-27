import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('frozen runtime permits existing-session reads and rejects all write entry points', async ({ page, request }) => {
  test.skip(process.env.E2E_WRITE_FREEZE !== 'true', 'Requires frozen server run');
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
  const api = `/api/v1/organisations/${fixture.organisationId}`;
  await page.goto(`/org/${fixture.organisationId}/audit`);
  await expect(page.getByRole('status')).toContainText('Maintenance is in progress');
  expect((await page.request.get(`${api}/audit/history`)).status()).toBe(200);
  const before = await (await page.request.get(api)).json();
  const edit = await page.request.patch(api, {
    headers: { origin: 'http://localhost:3101' },
    data: { name: 'should not change' },
  });
  expect(edit.status()).toBe(503);
  expect((await edit.json()).code).toBe('WRITE_FREEZE');
  expect(await (await page.request.get(api)).json()).toEqual(before);
  expect((await page.request.get(`${api}/audit/export`)).status()).toBe(503);
  expect((await request.post('/api/stripe/webhook', { data: 'fixture' })).status()).toBe(503);
  expect((await request.get('/api/auth/callback/email?token=fixture')).status()).toBe(503);
  expect((await request.post('/api/auth/signout')).status()).toBe(503);
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(health.headers()['x-write-freeze']).toBe('enabled');
  await page.goto('/signup');
  await page.getByLabel('Email address', { exact: true }).fill('blocked-freeze@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Blocked-Test123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Blocked-Test123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Maintenance' })).toBeVisible();
});
