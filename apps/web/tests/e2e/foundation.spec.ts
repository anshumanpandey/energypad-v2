import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
// Load this CommonJS dependency outside Playwright’s ESM import hook.
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
async function mailLink(email: string, type: 'signin' | 'invite') {
  let link = '';
  await expect
    .poll(async () => {
      const directory = path.resolve('.local/mail');
      const names = await readdir(directory).catch(() => []);
      for (const name of names.sort().reverse()) {
        const message = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
        if (message.to !== email || !message.subject.includes(type === 'signin' ? 'sign-in link' : 'Join ')) continue;
        link = message.text.match(/http:\/\/localhost:3101\/[^\s]+/)?.[0] ?? '';
        if (link) break;
      }
      return !!link;
    })
    .toBe(true);
  return link;
}
async function signIn(page: Page, email: string) {
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  const link = await mailLink(email, 'signin');
  await page.goto(link);
  return link;
}
test('verified login, onboarding, membership lifecycle, tenant isolation and responsive shell', async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = randomUUID().slice(0, 8),
    ownerEmail = `owner-${suffix}@example.test`,
    memberEmail = `member-${suffix}@example.test`;
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get('/api/v1/organisations')).status()).toBe(401);
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true });
  const oneTimeLink = await signIn(page, ownerEmail);
  await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
  await page.getByLabel('Organisation name').fill('Northstar Properties');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A better view starts here.' })).toBeVisible();
  const orgId = page.url().split('/')[4],
    orgPath = `/org/${orgId}`,
    apiPath = `/api/v1/organisations/${orgId}`;
  await page.screenshot({ path: testInfo.outputPath('overview-desktop.png'), fullPage: true });
  const deniedOrigin = await page.request.patch(apiPath, {
    data: { name: 'Bad', currency: 'GBP', timezone: 'UTC' },
    headers: { Origin: 'https://elsewhere.example' },
  });
  expect(deniedOrigin.status()).toBe(403);
  expect(
    (
      await page.request.patch(apiPath, {
        data: { name: 'Bad', currency: 'GBP', timezone: 'UTC', planKey: 'ENTERPRISE' },
        headers: { Origin: 'http://localhost:3101' },
      })
    ).status(),
  ).toBe(400);
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  for (const [name, section] of [
    ['Energy', 'energy'],
    ['Carbon', 'carbon'],
    ['Opportunities', 'opportunities'],
    ['AI Analyst', 'ai-analyst'],
    ['Billing', 'billing'],
  ]) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${orgPath}/${section}$`));
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    if (section !== 'energy') await expect(page.getByText('Coming in a later release', { exact: true })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Add a site to get started' })).toBeVisible();
  }
  await navigation.getByRole('link', { name: 'Energy', exact: true }).click();
  await page.getByRole('link', { name: 'Advanced Analysis', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Advanced Analysis', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Energy', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Organisation name').fill('Northstar Energy');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Changes saved');
  await page.getByRole('link', { name: 'Team members', exact: true }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByLabel('Member role').selectOption('VIEWER');
  await page.getByRole('button', { name: 'Save role' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'at least one owner' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Invite member' }).click();
  await page.getByLabel('Email address').fill(memberEmail);
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByRole('status')).toContainText('Invitation sent');
  const invitation = await mailLink(memberEmail, 'invite');
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await member.goto(invitation);
  await signIn(member, memberEmail);
  await expect(member.getByRole('heading', { name: 'Join Northstar Energy' })).toBeVisible();
  await member.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(member).toHaveURL(new RegExp(`${orgPath}/overview`));
  expect((await member.request.get(`${apiPath}/members`)).status()).toBe(403);
  await expect(member.getByRole('link', { name: 'Billing', exact: true })).toHaveCount(0);
  // Streamed not-found pages may have HTTP 200; verify the access-denied UI.
  await member.goto(`${orgPath}/billing`);
  await expect(member.getByRole('heading', { name: 'We couldn’t find that page.' })).toBeVisible();
  await expect(member.getByRole('heading', { name: 'Manage your subscription' })).toHaveCount(0);
  await member.goto(invitation);
  await expect(member.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await member.goto('/onboarding');
  await member.getByLabel('Organisation name').fill('Another organisation');
  await member.getByRole('button', { name: 'Create workspace' }).click();
  await expect(member.getByRole('heading', { name: 'A better view starts here.' })).toBeVisible();
  const otherId = member.url().split('/')[4];
  expect((await page.request.get(`/api/v1/organisations/${otherId}`)).status()).toBe(404);
  await member.getByLabel('Switch organisation').selectOption(orgId);
  await expect(member).toHaveURL(new RegExp(`${orgPath}/overview`));
  await page.reload();
  const row = page.locator('.member-row').filter({ hasText: memberEmail });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Manage', exact: true }).click();
  await row.getByLabel('Member role').selectOption('SITE_MANAGER');
  await row.getByRole('button', { name: 'Save role' }).click();
  await expect(row.getByRole('status')).toContainText('Changes saved');
  await member.goto(`${orgPath}/sites`);
  await expect(member.getByText('No sites assigned yet.', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('members-desktop.png'), fullPage: true });
  await row.getByRole('button', { name: 'Remove member', exact: true }).click();
  await row.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(row).toHaveCount(0);
  expect((await member.request.get(apiPath)).status()).toBe(404);
  await page.getByRole('link', { name: 'Activity log' }).click();
  await expect(page.getByText('Member access removed', { exact: true })).toBeVisible();
  await page.goto(`${orgPath}/overview`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('link', { name: 'Sites', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sites', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(`${orgPath}/overview`);
  await page.screenshot({ path: testInfo.outputPath('overview-mobile.png'), fullPage: true });
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(oneTimeLink);
  await expect(freshPage).toHaveURL(/\/login/);
  expect((await freshPage.request.get('/api/v1/organisations')).status()).toBe(401);
  await fresh.close();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get('/api/v1/organisations')).status()).toBe(401);
  expect(errors).toEqual([]);
  await memberContext.close();
});

test('onboarding submits without JavaScript and preserves input after validation errors', async ({ page, browser }) => {
  await page.goto('/login');
  await signIn(page, `onboarding-${randomUUID()}@example.test`);
  await expect(page.getByRole('heading', { name: 'Create your organisation' })).toBeVisible();
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
  });
  const formPage = await context.newPage();
  try {
    await formPage.goto('/onboarding');
    await expect(formPage.getByRole('button', { name: 'Create workspace' })).toBeEnabled();
    await formPage.getByLabel('Organisation name').fill('Progressive Workspace');
    await formPage.getByLabel('Time zone').fill('Invalid/Zone');
    await formPage.getByRole('button', { name: 'Create workspace' }).click();
    await expect(formPage.getByRole('alert').filter({ hasText: 'Choose a valid time zone' })).toBeVisible();
    await expect(formPage.getByLabel('Organisation name')).toHaveValue('Progressive Workspace');
    await formPage.getByLabel('Time zone').fill('Europe/London');
    await formPage.getByRole('button', { name: 'Create workspace' }).click();
    await expect(formPage).toHaveURL(/\/org\/[^/]+\/overview$/);
    const organisationId = formPage.url().split('/')[4];
    const response = await formPage.request.get(`/api/v1/organisations/${organisationId}`);
    expect(response.ok()).toBe(true);
    const workspace = await response.json();
    expect(workspace.organisation.name).toBe('Progressive Workspace');
    expect(workspace.membership.role).toBe('OWNER');
  } finally {
    await context.close();
  }
});

test('shared forms distinguish unavailable scripts from saving and recover after reload', async ({ page, browser }) => {
  await page.goto('/login');
  await signIn(page, `form-readiness-${randomUUID()}@example.test`);
  await page.getByLabel('Organisation name').fill('Form Readiness Workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/org\/[^/]+\/overview$/);
  const orgPath = new URL(page.url()).pathname.replace('/overview', '');
  const context = await browser.newContext({ storageState: await page.context().storageState() });
  // Keep inline streaming scripts working while simulating failed application bundles.
  await context.route('**/_next/static/**/*.js*', (route) => route.abort());
  const blocked = await context.newPage();
  try {
    await blocked.goto(`${orgPath}/settings`);
    await expect(blocked.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await expect(blocked.getByText('Interactive controls are still loading.', { exact: false })).toBeVisible();
    await expect(blocked.getByRole('button', { name: 'Saving…', exact: true })).toHaveCount(0);
    await blocked.goto(`${orgPath}/members`);
    await expect(blocked.getByRole('button', { name: 'Invite member', exact: true })).toBeDisabled();
    await expect(blocked.getByRole('button', { name: 'Manage', exact: true })).toBeDisabled();
    await expect(blocked.getByRole('link', { name: 'reload this page' }).first()).toBeVisible();
    await context.unrouteAll();
    await blocked.goto(`${orgPath}/settings`);
    await expect(blocked.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
    await expect(blocked.getByText('Interactive controls are still loading.', { exact: false })).toHaveCount(0);
    await blocked.getByLabel('Organisation name').fill('Recovered Workspace');
    let releaseRequest!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await blocked.route('**/api/v1/organisations/*', async (route) => {
      if (route.request().method() === 'PATCH') await release;
      await route.continue();
    });
    await blocked.getByRole('button', { name: 'Save changes', exact: true }).click();
    try {
      await expect(blocked.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    } finally {
      releaseRequest();
    }
    await expect(blocked.getByRole('status')).toContainText('Changes saved');
    await expect(blocked.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
    await blocked.reload();
    await expect(blocked.getByLabel('Organisation name')).toHaveValue('Recovered Workspace');
  } finally {
    await context.close();
  }
});

test('Sprint 2 site, meter and workbook import workflow', async ({ page }, testInfo) => {
  page.setDefaultTimeout(20_000);
  await page.goto('/login');
  await signIn(page, `sprint2-${randomUUID()}@example.test`);
  await page.getByLabel('Organisation name').fill('Sprint Two Workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/org\/[^/]+\/overview$/);
  const orgPath = new URL(page.url()).pathname.replace('/overview', '');
  await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
  await page.getByLabel('New portfolio name').fill('Regional sites');
  await page.getByRole('button', { name: 'Create portfolio', exact: true }).click();
  await expect(page.getByLabel('Portfolio name', { exact: true })).toHaveValue('Regional sites');
  await page.getByRole('link', { name: 'Sites', exact: true }).click();
  await page.getByRole('button', { name: 'Add site', exact: true }).click();
  await page.getByLabel('Site code', { exact: true }).fill('MANUAL');
  await page.getByLabel('Site name', { exact: true }).fill('Manual Site');
  await page.getByLabel('Currency (3-letter code)').fill('gBp');
  await page.getByLabel('Portfolio', { exact: true }).selectOption({ label: 'Regional sites' });
  await page.getByRole('button', { name: 'Save site', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Attribute history' })).toBeVisible();
  await page.getByLabel('Effective date').fill('2026-01-01');
  await page.getByLabel('Population', { exact: true }).fill('0');
  await page.getByLabel('Floor area (m²)').fill('1200.5');
  await page.getByRole('button', { name: 'Add history entry' }).click();
  const history = page.locator('.site-history-entry');
  await expect(history.getByText('2026-01-01', { exact: true })).toBeVisible();
  await expect(history.locator('dd').first()).toHaveText('0');
  await expect(page.getByLabel('Effective date')).toHaveValue('');
  await expect(page.getByLabel('Population', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Floor area (m²)')).toHaveValue('');
  await page.getByLabel('Effective date').fill('2026-01-01');
  await page.getByLabel('Population', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Add history entry' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Effective date')).toHaveValue('2026-01-01');
  await expect(page.getByLabel('Population', { exact: true })).toHaveValue('12');
  await page.getByLabel('Meter code').fill('MAIN');
  await page.getByLabel('Meter name').fill('Main electricity');
  await page.getByRole('button', { name: 'Add meter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit meter', exact: true })).toBeVisible();
  const newMeter = page.locator('form').filter({ has: page.getByRole('heading', { name: 'New meter', exact: true }) });
  await expect(newMeter.getByLabel('Meter code')).toHaveValue('');
  await expect(newMeter.getByLabel('Meter name')).toHaveValue('');
  await expect(newMeter.getByLabel('Fuel')).toHaveValue('ELECTRICITY');
  await expect(newMeter.getByLabel('Unit')).toHaveValue('kWh');
  await newMeter.getByLabel('Meter code').fill('MAIN');
  await newMeter.getByLabel('Meter name').fill('Duplicate meter');
  await newMeter.getByRole('button', { name: 'Add meter', exact: true }).click();
  await expect(newMeter.getByRole('alert')).toBeVisible();
  await expect(newMeter.getByLabel('Meter code')).toHaveValue('MAIN');
  await expect(newMeter.getByLabel('Meter name')).toHaveValue('Duplicate meter');
  await page.getByRole('link', { name: 'Data', exact: true }).click();
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet('Sites');
  sheet.addRow(['code', 'name', 'password']);
  sheet.addRow(['IMPORT-1', 'Imported Site', 'synthetic-secret-do-not-store']);
  sheet.addRow(['', 'Second Imported Site', 'synthetic-secret-do-not-store']);
  await page.getByLabel('Excel workbook').setInputFiles({
    name: 'sites.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Upload workbook' }).click();
  await expect(page.getByRole('heading', { name: '2. Map and validate' })).toBeVisible();
  await expect(page.getByText('synthetic-secret-do-not-store')).toHaveCount(0);
  await page.getByLabel('I confirm these sites belong').check();
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(page.getByRole('button', { name: 'Download row errors' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit import' })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download row errors' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('import-errors.csv');
  await page.getByLabel('Code prefix for rows without a code').fill('IMPORTED');
  await page.getByRole('button', { name: 'Validate and preview' }).click();
  await expect(page.getByRole('button', { name: 'Commit import' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('import-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Commit import' }).click();
  await expect(page.getByText('Import complete: 2 sites created.', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Sites', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Imported Site', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Second Imported Site', exact: true })).toBeVisible();
  const sites = await (await page.request.get(`/api/v1/organisations/${orgPath.split('/')[2]}/sites`)).json();
  expect(sites).toHaveLength(3);
  const manualSite = sites.find((site: { code: string }) => site.code === 'MANUAL');
  const savedSite = await (
    await page.request.get(`/api/v1/organisations/${orgPath.split('/')[2]}/sites/${manualSite.id}`)
  ).json();
  expect(savedSite.currency).toBe('GBP');
});

test('Sprint 3 monthly energy entry, quality flags and persistence', async ({ page }, testInfo) => {
  page.setDefaultTimeout(20_000);
  await page.goto('/login');
  await signIn(page, `energy-${randomUUID()}@example.test`);
  await page.getByLabel('Organisation name').fill('Energy Workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/org\/[^/]+\/overview$/);
  const org = new URL(page.url()).pathname.split('/')[2];
  const siteResponse = await page.request.post(`/api/v1/organisations/${org}/sites`, {
    headers: { origin: 'http://localhost:3101' },
    data: { code: 'ENERGY', name: 'Energy Site' },
  });
  expect(siteResponse.ok()).toBe(true);
  const site = await siteResponse.json();
  const meterResponse = await page.request.post(`/api/v1/organisations/${org}/sites/${site.id}/meters`, {
    headers: { origin: 'http://localhost:3101' },
    data: { code: 'E1', name: 'Main electricity', fuel: 'ELECTRICITY', unit: 'MWh' },
  });
  expect(meterResponse.ok()).toBe(true);
  await page.getByRole('link', { name: 'Energy', exact: true }).click();
  await page.getByLabel('Year', { exact: true }).fill('2024');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  await expect(page.getByRole('heading', { name: 'Record monthly consumption' })).toBeVisible();
  await page.getByLabel('Month', { exact: true }).fill('2024-02');
  await page.getByLabel('Quantity (meter units)').fill('1.25');
  await page.getByLabel('Net cost', { exact: true }).fill('100');
  await page.getByLabel('Currency (3-letter code)').fill('gBp');
  await page.getByLabel('VAT (%)').fill('20');
  await page.getByRole('button', { name: 'Save consumption' }).click();
  await expect(page.getByRole('status')).toContainText('Consumption recorded.');
  await expect(page.getByLabel('Quantity (meter units)')).toHaveValue('');
  await expect(page.getByText('Main electricity · 1/12 months recorded')).toBeVisible();
  await expect(page.getByRole('cell').filter({ hasText: /^1250/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: '100 / 120 GBP', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Missing population/ })).toBeVisible();
  await page.getByLabel('Month', { exact: true }).fill('2024-02');
  await page.getByLabel('Quantity (meter units)').fill('2');
  await page.getByRole('button', { name: 'Save consumption' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'already has a reading' })).toBeVisible();
  await expect(page.getByLabel('Quantity (meter units)')).toHaveValue('2');
  await page.screenshot({ path: testInfo.outputPath('energy.png'), fullPage: true });
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2024');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  await expect(page.getByRole('cell').filter({ hasText: /^1250/ })).toBeVisible();
  const gasResponse = await page.request.post(`/api/v1/organisations/${org}/sites/${site.id}/meters`, {
    headers: { origin: 'http://localhost:3101' },
    data: { code: 'G1', name: 'Gas meter', fuel: 'GAS', unit: 'm3' },
  });
  expect(gasResponse.ok()).toBe(true);
  const gas = await gasResponse.json();
  await page.getByRole('button', { name: 'Load energy records' }).click();
  await expect(page.getByRole('heading', { name: 'Add conversion factor' })).toBeVisible();
  await page.getByLabel('Conversion meter', { exact: true }).selectOption(gas.id);
  await page.getByLabel('kWh per source unit', { exact: true }).fill('10.5');
  await page.getByLabel('First month', { exact: true }).fill('2024-01');
  await page.getByLabel('Last month (inclusive)', { exact: true }).fill('2024-12');
  await page.getByLabel('Factor source / reference', { exact: true }).fill('Synthetic browser test reference');
  await page.getByRole('button', { name: 'Save conversion factor', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Conversion factor saved.');
  await expect(page.getByLabel('kWh per source unit', { exact: true })).toHaveValue('');
  await page.getByLabel('Energy meter', { exact: true }).selectOption(gas.id);
  await page.getByLabel('Month', { exact: true }).fill('2024-01');
  await page.getByLabel('Quantity (meter units)').fill('100');
  await page.getByRole('button', { name: 'Save consumption' }).click();
  await expect(page.getByRole('status')).toContainText('Consumption recorded.');
  const normalized = page.getByRole('cell').filter({ hasText: /^1050/ });
  await expect(normalized).toBeVisible();
  await normalized.getByText('Conversion details').click();
  await expect(normalized.getByText('Synthetic browser test reference', { exact: true })).toBeVisible();
});
