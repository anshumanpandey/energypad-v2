import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
test('report schedule HTTP lifecycle stays private and delivery stays disabled', async ({
  page,
  request,
}, testInfo) => {
  page.setDefaultTimeout(20_000);
  const fixture = JSON.parse(await readFile('.local/e2e-report-schedules.json', 'utf8'));
  await page.goto('/login/email');
  await page.getByLabel('Email address').fill(fixture.email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  let link = '';
  await expect
    .poll(async () => {
      for (const name of await readdir('.local/mail')) {
        const message = JSON.parse(await readFile(`.local/mail/${name}`, 'utf8'));
        if (message.to === fixture.email) link = message.text.match(/http:\/\/localhost:3101\/[^\s]+/)?.[0] ?? '';
      }
      return !!link;
    })
    .toBe(true);
  await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const siteBase = `/api/v1/organisations/${fixture.organisationId}/sites/${fixture.siteId}`;
  const base = `${siteBase}/report-schedules`;
  const headers = { origin: 'http://localhost:3101' };
  expect((await request.get(base)).status()).toBe(401);
  const preview = await page.request.get(`${siteBase}/reports?family=energy&year=2020`);
  expect(preview.ok()).toBe(true);
  const fingerprint = preview.headers()['x-report-fingerprint'];
  const archiveResponse = await page.request.post(`${siteBase}/report-archives`, {
    headers,
    data: { definition: { family: 'energy', year: 2020 }, fingerprint, requestKey: randomUUID() },
  });
  expect(archiveResponse.ok()).toBe(true);
  const archive = await archiveResponse.json();
  const data = {
    action: 'DRAFT',
    requestKey: randomUUID(),
    archiveId: archive.id,
    fingerprint,
    recipientMembershipIds: [fixture.membershipId],
    timezone: 'Europe/London',
  };
  expect((await page.request.post(base, { headers: { origin: 'https://untrusted.example' }, data })).status()).toBe(
    403,
  );
  const create = await page.request.post(base, { headers, data });
  expect(create.ok()).toBe(true);
  expect(create.headers()['cache-control']).toBe('no-store');
  const created = await create.json();
  expect(created.delivery).toBe('DISABLED');
  expect(created.revision.state).toBe('DRAFT');
  expect(created.revision.requestKey).toBeUndefined();
  expect(created.revision.requestHash).toBeUndefined();
  const id = created.revision.scheduleId;
  expect((await (await page.request.post(base, { headers, data })).json()).revision.id).toBe(created.revision.id);
  const detail = await (await page.request.get(`${base}/${id}`)).json();
  expect(detail.latest.id).toBe(created.revision.id);
  const listed = await (await page.request.get(base)).json();
  expect(listed.items.some((r: { id: string }) => r.id === id)).toBe(true);
  expect((await page.request.get(`${base}?cursor=${randomUUID()}`)).status()).toBe(404);
  expect((await page.request.get(`${base}/not-a-uuid`)).status()).toBe(400);
  const occurrence = { revisionId: created.revision.id, occurrenceAt: '2026-10-25T01:30:00.000Z' };
  const prepared = await page.request.post(`${base}/${id}/jobs`, { headers, data: occurrence });
  expect(prepared.ok()).toBe(true);
  const job = (await prepared.json()).job;
  expect(job.status).toBe('HELD');
  const edit = {
    ...data,
    scheduleId: id,
    expectedRevisionId: created.revision.id,
    requestKey: randomUUID(),
    timezone: 'UTC',
  };
  const edited = await page.request.post(base, { headers, data: edit });
  expect(edited.ok()).toBe(true);
  const revision = (await edited.json()).revision;
  expect((await page.request.post(base, { headers, data: { ...edit, requestKey: randomUUID() } })).status()).toBe(409);
  expect((await page.request.post(`${base}/${id}/jobs`, { headers, data: occurrence })).status()).toBe(409);
  const jobs = await (await page.request.get(`${base}/${id}/jobs`)).json();
  expect(jobs.items[0]).toMatchObject({ id: job.id, status: 'CANCELLED' });
  const cancelled = await page.request.post(base, {
    headers,
    data: { action: 'CANCEL', scheduleId: id, expectedRevisionId: revision.id, requestKey: randomUUID() },
  });
  expect(cancelled.ok()).toBe(true);
  const history = await (await page.request.get(`${base}/${id}/history`)).json();
  expect(history.items.map((r: { state: string }) => r.state)).toEqual(['CANCELLED', 'DRAFT', 'DRAFT']);
  expect(history.delivery).toBe('DISABLED');
  expect(
    (
      await page.request.post(base, { headers, data: { ...data, action: 'ACTIVE', requestKey: randomUUID() } })
    ).status(),
  ).toBe(400);
  expect((await page.request.post(`${base}/${id}/send`, { headers, data: {} })).status()).toBe(404);
  // Manage the same backend through the Reports panel, including conflict recovery.
  await page.goto(`/org/${fixture.organisationId}/reports`);
  const panel = page.getByRole('region', { name: 'Report schedules', exact: true });
  await expect(panel).toContainText('Automatic scheduling and email delivery are disabled.');
  await panel.getByRole('button', { name: 'New schedule draft', exact: true }).click();
  await panel.getByLabel('Retained report', { exact: true }).selectOption(archive.id);
  await panel.getByLabel('Schedule time zone', { exact: true }).fill('Europe/London');
  const uiSaved = page.waitForResponse((r) => r.url().endsWith('/report-schedules') && r.request().method() === 'POST');
  await panel.getByRole('button', { name: 'Save schedule draft', exact: true }).click();
  const uiRevision = (await (await uiSaved).json()).revision;
  await expect(panel.getByRole('status')).toHaveText('Schedule draft saved. Delivery remains disabled.');
  await panel.getByLabel('Occurrence time (UTC)', { exact: true }).fill('25/10/2026 01:30');
  await panel.getByRole('button', { name: 'Prepare held occurrence', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Occurrence held. Nothing has been sent.');
  await expect(panel.getByLabel('Occurrence time (UTC)', { exact: true })).toHaveValue('');
  await expect(panel.getByRole('region', { name: 'Schedule occurrence jobs' })).toContainText('HELD');
  await expect(panel.getByRole('region', { name: 'Schedule occurrence jobs' })).toContainText(
    '2026-10-25T01:30:00.000Z',
  );
  await panel.getByLabel('Schedule time zone', { exact: true }).fill('UTC');
  await panel.getByRole('button', { name: 'Save schedule draft', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Selected schedule · revision 2', exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Schedule occurrence jobs' })).toContainText('CANCELLED');
  await page.reload();
  await panel.getByRole('button', { name: 'Refresh my schedules', exact: true }).click();
  await panel
    .locator(`[data-schedule-id="${uiRevision.scheduleId}"]`)
    .getByRole('button', { name: 'Open schedule', exact: true })
    .click();
  await expect(panel.getByLabel('Schedule time zone', { exact: true })).toHaveValue('UTC');
  const latestUI = await (await page.request.get(`${base}/${uiRevision.scheduleId}`)).json();
  const concurrent = await page.request.post(base, {
    headers,
    data: {
      ...data,
      scheduleId: uiRevision.scheduleId,
      expectedRevisionId: latestUI.latest.id,
      requestKey: randomUUID(),
      timezone: 'America/Bogota',
    },
  });
  expect(concurrent.ok()).toBe(true);
  await panel.getByLabel('Schedule time zone', { exact: true }).fill('Europe/London');
  await panel.getByRole('button', { name: 'Save schedule draft', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Reload the latest schedule revision');
  await panel.getByRole('button', { name: 'Reload selected schedule', exact: true }).click();
  await expect(panel.getByLabel('Schedule time zone', { exact: true })).toHaveValue('America/Bogota');
  await panel.getByRole('button', { name: 'Cancel schedule', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Schedule cancelled. Its held occurrences are cancelled too.');
  await expect(panel.getByRole('button', { name: 'Cancel schedule', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Save schedule draft', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.screenshot({ path: testInfo.outputPath('report-schedule-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel
    .locator(`[data-schedule-id="${fixture.checkScheduleId}"]`)
    .getByRole('button', { name: 'Open schedule', exact: true })
    .click();
  await panel.getByRole('button', { name: 'View readiness checks', exact: true }).click();
  const checks = panel.getByRole('region', { name: 'Delivery readiness checks', exact: true });
  await expect(checks.locator('[data-check-id]')).toHaveCount(25);
  await expect(checks).toContainText('Lease expired — recovery pending');
  await expect(checks).toContainText('Ready — not sent');
  await checks.getByRole('button', { name: 'Load older readiness checks', exact: true }).click();
  await expect(checks.locator('[data-check-id]')).toHaveCount(28);
  await expect(checks).toContainText('Interrupted — not sent');
  await expect(checks).toContainText('The plan did not allow scheduled reports.');
  await expect(checks.getByRole('button', { name: 'Load older readiness checks', exact: true })).toHaveCount(0);
  const checkPath = `${base}/${fixture.checkScheduleId}/jobs/${fixture.checkJobId}/checks`;
  const firstChecks = await page.request.get(checkPath);
  expect(firstChecks.headers()['cache-control']).toBe('no-store');
  const checksPage = await firstChecks.json();
  expect(checksPage.items).toHaveLength(25);
  expect(JSON.stringify(checksPage)).not.toMatch(/token|requestKey/);
  const older = await (await page.request.get(`${checkPath}?cursor=${checksPage.nextCursor}`)).json();
  expect(older.items).toHaveLength(3);
  expect(new Set([...checksPage.items, ...older.items].map((r: { id: string }) => r.id)).size).toBe(28);
  expect((await page.request.get(`${checkPath}?cursor=${randomUUID()}`)).status()).toBe(404);
  expect((await request.get(checkPath)).status()).toBe(401);
  expect((await page.request.post(checkPath, { headers, data: {} })).status()).toBe(400);
  await checks.getByRole('button', { name: 'Refresh readiness checks', exact: true }).click();
  await expect(checks.locator('[data-check-id]')).toHaveCount(25);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const recoveryResponse = page.waitForResponse((r) => r.url().endsWith('/checks') && r.request().method() === 'POST');
  await checks.getByRole('button', { name: 'Recover and recheck', exact: true }).click();
  const recovered = await recoveryResponse;
  expect(recovered.ok()).toBe(true);
  expect(await recovered.json()).toEqual({ delivery: 'DISABLED', status: 'READY_NO_SEND', code: 'ELIGIBLE_NO_SEND' });
  await expect(panel.getByRole('status')).toHaveText('Readiness check passed. No report was sent.');
  await expect(checks).not.toContainText('Lease expired — recovery pending');
  await expect(checks.getByRole('button', { name: 'Recover and recheck', exact: true })).toHaveCount(0);
  const retryData = recovered.request().postDataJSON();
  const retryCheck = await page.request.post(checkPath, { headers, data: retryData });
  expect(await retryCheck.json()).toEqual(await recovered.json());
  const afterRecovery = await (await page.request.get(checkPath)).json();
  expect(afterRecovery.items[0].attempt).toBe(29);
  expect(afterRecovery.items[1].status).toBe('INTERRUPTED');
  expect(JSON.stringify(await retryCheck.json())).not.toMatch(/token|requestKey/);
  expect((await request.post(checkPath, { headers, data: { requestKey: randomUUID() } })).status()).toBe(401);
  expect(
    (
      await page.request.post(checkPath, {
        headers: { origin: 'https://untrusted.example' },
        data: { requestKey: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.post(checkPath, { headers, data: { requestKey: randomUUID(), token: randomUUID() } })).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post(`${base}/${id}/jobs/${fixture.checkJobId}/checks`, {
        headers,
        data: { requestKey: randomUUID() },
      })
    ).status(),
  ).toBe(404);
  await panel.getByRole('button', { name: 'Run readiness check', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Readiness check passed. No report was sent.');
  await expect(checks.locator('[data-check-id]').first()).toContainText('Check 30');
  const currentDraft = await (await page.request.get(`${base}/${fixture.checkScheduleId}`)).json();
  const futureJob = await (
    await page.request.post(`${base}/${fixture.checkScheduleId}/jobs`, {
      headers,
      data: { revisionId: currentDraft.latest.id, occurrenceAt: '2120-01-01T00:00:00.000Z' },
    })
  ).json();
  const futureCheck = await page.request.post(`${base}/${fixture.checkScheduleId}/jobs/${futureJob.job.id}/checks`, {
    headers,
    data: { requestKey: randomUUID() },
  });
  expect(await futureCheck.json()).toEqual({ delivery: 'DISABLED', status: 'NOT_DUE' });
});
