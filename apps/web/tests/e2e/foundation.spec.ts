import { aggregateWeather } from '../../src/domain/weather';
import { syntheticWeather } from '../fixtures/weather';
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
  const url = new URL(page.url());
  url.pathname = '/login/email';
  await page.goto(url.toString());
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
  const book = new ExcelJS.Workbook();
  const readingSheet = book.addWorksheet('Monthly readings');
  readingSheet.addRow(['month', 'quantity', 'password']);
  for (let month = 1; month <= 12; month++)
    readingSheet.addRow([`2021-${String(month).padStart(2, '0')}`, '1', 'synthetic-import-secret']);
  await page.getByLabel('Consumption workbook', { exact: true }).setInputFiles({
    name: 'consumption.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Upload consumption workbook', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Map consumption columns' })).toBeVisible();
  await expect(page.getByText('synthetic-import-secret')).toHaveCount(0);
  await page.getByLabel('Month (YYYY-MM) column', { exact: true }).selectOption('0');
  await page.getByLabel('Quantity column', { exact: true }).selectOption('1');
  await page.getByLabel('Source unit default', { exact: true }).fill('m3');
  await page.getByLabel('Reading status (actual / estimated) default', { exact: true }).fill('actual');
  const savedMappingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save mapping template v1', exact: true }).click();
  const savedMappingPath = await (await savedMappingDownload).path();
  await page.getByLabel('Source unit default', { exact: true }).fill('kWh');
  await page.getByLabel('Load saved mapping template').setInputFiles(savedMappingPath!);
  await expect(page.getByLabel('Source unit default', { exact: true })).toHaveValue('m3');
  await page.getByLabel('I confirm these rows belong').check();
  await page.getByRole('button', { name: 'Validate consumption import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit consumption import', exact: true })).toBeDisabled();
  const errorDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download consumption errors', exact: true }).click();
  expect((await errorDownload).suggestedFilename()).toBe('consumption-errors.csv');
  await page.getByLabel('Source unit default', { exact: true }).fill('MWh');
  await page.getByRole('button', { name: 'Validate consumption import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit consumption import', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('consumption-import.png'), fullPage: true });
  await page.getByRole('button', { name: 'Commit consumption import', exact: true }).click();
  await expect(page.getByText('Consumption import complete: 12 readings created.', { exact: true })).toBeVisible();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(page.getByText('Main electricity · 12/12 months recorded', { exact: true })).toBeVisible();
  const drivers = page.getByRole('region', { name: 'Drivers and schedules' });
  await expect(drivers.getByText('Average population (people) · 0/12 months observed', { exact: true })).toBeVisible();
  await drivers.getByLabel('Observation month').fill('2021-01');
  await drivers.getByLabel('Observed value').fill('0');
  await drivers.getByLabel('Observation source').fill('Synthetic attendance');
  await drivers.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(drivers.getByRole('status')).toContainText('Monthly observation saved.');
  await expect(drivers.getByLabel('Observed value')).toHaveValue('');
  await expect(drivers.getByText('Average population (people) · 1/12 months observed', { exact: true })).toBeVisible();
  await drivers.getByLabel('Schedule name').fill('Standard week');
  await drivers.getByLabel('First day', { exact: true }).fill('2021-01-01');
  await drivers.getByLabel('Last day (inclusive)', { exact: true }).fill('2021-12-31');
  await drivers.getByLabel('Planned weekly hours').fill('40');
  await drivers.getByLabel('Schedule source').fill('Synthetic operating plan');
  await drivers.getByRole('button', { name: 'Save operating schedule', exact: true }).click();
  await expect(drivers.getByText('Standard week · 40 hours/week', { exact: true })).toBeVisible();
  await expect(drivers.getByLabel('Schedule name')).toHaveValue('');
  await drivers.getByLabel('Schedule name').fill('Overlap');
  await drivers.getByLabel('First day', { exact: true }).fill('2021-06-01');
  await drivers.getByLabel('Last day (inclusive)', { exact: true }).fill('2021-12-31');
  await drivers.getByLabel('Planned weekly hours').fill('20');
  await drivers.getByLabel('Schedule source').fill('Synthetic conflicting plan');
  await drivers.getByRole('button', { name: 'Save operating schedule', exact: true }).click();
  await expect(drivers.getByRole('alert')).toContainText('already covers');
  await expect(drivers.getByLabel('Schedule name')).toHaveValue('Overlap');
  const driverBook = new ExcelJS.Workbook();
  const driverSheet = driverBook.addWorksheet('Drivers');
  driverSheet.addRow(['month', 'driver', 'value', 'source']);
  for (let month = 1; month <= 12; month++)
    driverSheet.addRow([
      `2021-${String(month).padStart(2, '0')}`,
      'OPERATING_HOURS',
      '160',
      'Synthetic operations log',
    ]);
  await drivers.getByLabel('Driver workbook', { exact: true }).setInputFiles({
    name: 'drivers.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await driverBook.xlsx.writeBuffer()),
  });
  await drivers.getByRole('button', { name: 'Preview driver workbook', exact: true }).click();
  await expect(drivers.getByText('Driver import: READY · 12 valid rows · 0 errors', { exact: true })).toBeVisible();
  await expect(drivers.getByRole('button', { name: 'Commit driver import', exact: true })).toBeDisabled();
  await drivers.getByLabel('I confirm the selected site').check();
  await drivers.getByRole('button', { name: 'Commit driver import', exact: true }).click();
  await expect(
    drivers.getByText('Total operating hours (hours/month) · 12/12 months observed', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(
    drivers.getByText('Total operating hours (hours/month) · 12/12 months observed', { exact: true }),
  ).toBeVisible();
  await expect(drivers.getByRole('row').filter({ hasText: 'Synthetic attendance' })).toContainText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await drivers.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('monthly-drivers-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const weather = page.getByRole('region', { name: 'Historical weather' });
  await weather.getByLabel('Weather latitude').fill('51.5');
  await weather.getByLabel('Weather longitude').fill('-0.12');
  await weather.getByLabel('Weather timezone').fill('Europe/London');
  await weather.getByLabel('Heating base (°C)').fill('15');
  await weather.getByLabel('Cooling base (°C)').fill('20');
  await weather.getByLabel('Weather settings source').fill('Synthetic browser settings');
  await weather.getByRole('button', { name: 'Save weather settings', exact: true }).click();
  await expect(weather.getByRole('status')).toContainText('Weather settings saved');
  const configId = await weather.getByLabel('Weather settings version').inputValue();
  // Browser response fixture only; the real adapter/database are covered by integration tests.
  // This avoids transmitting test sites or relying on an external service in the browser suite.

  const queueUrl = `/api/v1/organisations/${org}/sites/${site.id}/energy/weather/enrich`;
  const queueRequest = {
    headers: { origin: 'http://localhost:3101' },
    data: { configurationId: configId, year: 2020 },
  };
  const queued = await page.request.post(queueUrl, queueRequest);
  expect(queued.ok()).toBe(true);
  const durableJob = await queued.json();
  expect(durableJob.status).toBe('QUEUED');
  expect((await (await page.request.post(queueUrl, queueRequest)).json()).id).toBe(durableJob.id);
  let browserResult: unknown = null;
  let browserJob: Record<string, unknown> | null = null;
  const weatherPath = `**/api/v1/organisations/${org}/sites/${site.id}/energy/weather`;
  await page.route(`${weatherPath}?year=2021`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: {
        ...body,
        jobs: browserJob ? [browserJob] : body.jobs,
        results: browserResult ? [browserResult] : body.results,
      },
    });
  });
  const queueBrowserJob = () => ({
    id: 'synthetic-job',
    configurationId: configId,
    status: 'QUEUED',
    attempts: 0,
    totalAttempts: 0,
    availableAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: null,
  });
  await page.route(`${weatherPath}/enrich`, async (route) => {
    browserJob = queueBrowserJob();
    await route.fulfill({ json: browserJob });
  });
  await page.route(`${weatherPath}/jobs/synthetic-job/retry`, async (route) => {
    browserJob = queueBrowserJob();
    await route.fulfill({ json: browserJob });
  });
  await weather.getByRole('button', { name: 'Fetch weather for 2021', exact: true }).click();
  await expect(weather.getByText('Queued · Attempt 0/3', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(weather.getByText('Queued · Attempt 0/3', { exact: true })).toBeVisible();
  browserJob = {
    ...queueBrowserJob(),
    status: 'RETRY_WAIT',
    attempts: 1,
    lastError: 'The weather provider could not be reached or returned an error.',
  };
  await weather.getByRole('button', { name: 'Refresh weather status', exact: true }).click();
  await expect(weather.getByText('Waiting to retry · Attempt 1/3', { exact: true })).toBeVisible();
  browserJob = {
    ...queueBrowserJob(),
    status: 'FAILED',
    attempts: 3,
    lastError: 'The weather provider could not be reached or returned an error.',
  };
  await weather.getByRole('button', { name: 'Refresh weather status', exact: true }).click();
  await expect(weather.getByRole('alert')).toContainText('weather provider');
  await weather.getByRole('button', { name: 'Retry weather job', exact: true }).click();
  await expect(weather.getByText('Queued · Attempt 0/3', { exact: true })).toBeVisible();
  const raw = syntheticWeather(2021);
  const daily = raw.daily.time.map((date, i) => ({
    date,
    meanTemperature: raw.daily.temperature_2m_mean[i],
    daylightSeconds: raw.daily.daylight_duration[i],
  }));
  browserJob = { ...queueBrowserJob(), status: 'SUCCEEDED', attempts: 1 };
  browserResult = {
    id: 'synthetic-browser-result',
    configurationId: configId,
    year: 2021,
    methodology: 'daily-mean-degree-days-v1',
    monthly: aggregateWeather(daily, { heatingBase: '15', coolingBase: '20' }),
    inputHash: 'synthetic-browser-fixture',
    createdAt: new Date().toISOString(),
    provenance: {
      provider: 'Open-Meteo',
      dataset: 'ERA5',
      returnedLatitude: 51.5,
      returnedLongitude: -0.125,
      timezone: 'Europe/London',
      retrievedAt: new Date().toISOString(),
      licence: 'CC BY 4.0',
    },
  };
  // Automatic polling must pick up completed work without clicking Refresh.
  await expect(weather.getByText('12/12 months enriched', { exact: true })).toBeVisible();
  await expect(weather.getByRole('row').filter({ hasText: '2021-02' })).toContainText('140');
  await weather.getByText('Weather provenance and method', { exact: true }).click();
  await expect(weather.getByText(/Returned grid coordinates: 51.5/)).toBeVisible();
  await weather.getByText('Add a weather settings version', { exact: true }).click();
  await weather.getByLabel('Heating base (°C)').fill('16');
  await weather.getByLabel('Weather settings source').fill('Synthetic revised policy');
  await weather.getByRole('button', { name: 'Save weather settings', exact: true }).click();
  await expect(weather.getByText('0/12 months enriched for this settings version', { exact: true })).toBeVisible();
  await weather.getByLabel('Weather settings version').selectOption(configId);
  await expect(weather.getByText('12/12 months enriched', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await weather.screenshot({ path: testInfo.outputPath('weather-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Year', { exact: true }).fill('2024');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await page.getByRole('button', { name: 'Correct conversion factor', exact: true }).click();
  const factorForm = page.getByRole('form', { name: 'Correct conversion factor', exact: true });
  await factorForm.getByLabel('Corrected kWh per m3').fill('11');
  await factorForm.getByLabel('Corrected factor source').fill('Revised synthetic browser factor');
  await factorForm.getByLabel('Conversion correction reason').fill('Supplier corrected test factor');
  await factorForm.getByRole('button', { name: 'Save conversion correction', exact: true }).click();
  await expect(page.getByText('Source: Revised synthetic browser factor', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell').filter({ hasText: /^1050/ })).toBeVisible();
  await page.getByRole('button', { name: 'View factor history', exact: true }).click();
  await expect(page.getByText('Supplier corrected test factor', { exact: true })).toBeVisible();
  const gasRow = page.getByRole('row').filter({ hasText: 'Gas meter' }).filter({ hasText: '2024-01' });
  await gasRow.getByRole('button', { name: 'Correct reading', exact: true }).click();
  const correctionForm = page.getByRole('form', { name: 'Correct monthly reading', exact: true });
  await correctionForm.getByLabel('Corrected quantity (m3)').fill('200');
  await correctionForm.getByLabel('Reading correction reason').fill('Correct quantity and apply revised factor');
  await correctionForm.getByLabel('Apply the current sourced conversion for this month').check();
  await correctionForm.getByRole('button', { name: 'Save reading correction', exact: true }).click();
  await expect(gasRow.getByRole('cell').filter({ hasText: /^2200/ })).toBeVisible();
  await expect(page.getByText('Gas meter · 1/12 months recorded', { exact: true })).toBeVisible();
  await gasRow.getByRole('button', { name: 'View reading history', exact: true }).click();
  await expect(gasRow.getByText('100 m3 → 1050 kWh · Actual', { exact: true })).toBeVisible();
  await expect(gasRow.getByText('200 m3 → 2200 kWh · Actual', { exact: true })).toBeVisible();
  await gasRow.getByRole('button', { name: 'Correct reading', exact: true }).click();
  await correctionForm.getByLabel('Corrected quantity (m3)').fill('300');
  await correctionForm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(correctionForm).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2024');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(gasRow.getByRole('cell').filter({ hasText: /^2200/ })).toBeVisible();
  await gasRow.getByRole('button', { name: 'View reading history', exact: true }).click();
  await expect(gasRow.getByText('100 m3 → 1050 kWh · Actual', { exact: true })).toBeVisible();
  await gasRow.screenshot({ path: testInfo.outputPath('reading-correction-history.png') });
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  const observationRow = drivers
    .getByRole('row')
    .filter({ hasText: 'Average population (people)' })
    .filter({ hasText: '2021-01' });
  await observationRow.getByRole('button', { name: 'Correct observation', exact: true }).click();
  const observationForm = drivers.getByRole('form', { name: 'Correct observation', exact: true });
  await observationForm.getByLabel('Corrected observed value').fill('25');
  await observationForm.getByLabel('Correction reason', { exact: true }).fill('Correct attendance count');
  await observationForm.getByRole('button', { name: 'Save observation correction', exact: true }).click();
  await expect(observationRow.getByRole('cell', { name: '25', exact: true })).toBeVisible();
  await expect(drivers.getByText('Average population (people) · 1/12 months observed', { exact: true })).toBeVisible();
  await observationRow.getByRole('button', { name: 'View observation history', exact: true }).click();
  await expect(observationRow.getByText('2021-01 · POPULATION · 0', { exact: true })).toBeVisible();
  await observationRow.getByRole('button', { name: 'Correct observation', exact: true }).click();
  await observationForm.getByLabel('Corrected observed value').fill('99');
  await observationForm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(observationForm).toHaveCount(0);
  await drivers.getByRole('button', { name: 'Correct schedule', exact: true }).click();
  const scheduleForm = drivers.getByRole('form', { name: 'Correct schedule', exact: true });
  await scheduleForm.getByLabel('Corrected weekly hours').fill('35');
  await scheduleForm.getByLabel('Correction reason', { exact: true }).fill('Correct weekly plan');
  await scheduleForm.getByRole('button', { name: 'Save schedule correction', exact: true }).click();
  await expect(drivers.getByText('Standard week · 35 hours/week', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(observationRow.getByRole('cell', { name: '25', exact: true })).toBeVisible();
  await drivers.getByRole('button', { name: 'View schedule history', exact: true }).click();
  await expect(
    drivers.getByText('Standard week · 40 hours/week · 2021-01-01 to 2021-12-31 inclusive', { exact: true }),
  ).toBeVisible();
  await observationRow.getByRole('button', { name: 'View observation history', exact: true }).click();
  await observationRow.screenshot({ path: testInfo.outputPath('driver-correction-history.png') });

  const catalogPanel = page.getByRole('region', { name: 'Shared energy catalog' });
  await catalogPanel.getByRole('button', { name: 'Add catalog entry', exact: true }).click();
  const catalogForm = catalogPanel.getByRole('form', { name: 'Add catalog entry', exact: true });
  await catalogForm.getByRole('combobox', { name: 'Catalog kind', exact: true }).selectOption('FUEL');
  await catalogForm.getByLabel('Catalog code', { exact: true }).fill('POWER');
  await catalogForm.getByRole('combobox', { name: 'Catalog fuel', exact: true }).selectOption('ELECTRICITY');
  await catalogForm.getByLabel('Catalog label', { exact: true }).fill('Grid power');
  await catalogForm.getByLabel('Catalog colour', { exact: true }).fill('#123abc');
  await catalogForm.getByLabel('Catalog source', { exact: true }).fill('Synthetic supplier catalog');
  await catalogForm.getByRole('button', { name: 'Save catalog entry', exact: true }).click();
  await expect(catalogPanel.getByText('FUEL · POWER · Grid power · Revision 1', { exact: true })).toBeVisible();
  const pricing = page.getByRole('region', { name: 'Tariffs and end uses' });
  await pricing.getByText('Register a site end use', { exact: true }).click();
  const useForm = pricing.getByRole('form', { name: 'Add site end use', exact: true });
  await useForm.getByLabel('End-use code', { exact: true }).fill('lighting');
  await useForm.getByLabel('End-use name', { exact: true }).fill('Lighting');
  await useForm.getByRole('combobox', { name: 'End-use fuel', exact: true }).selectOption('ELECTRICITY');
  await useForm.getByLabel('End-use source', { exact: true }).fill('Synthetic site inventory');
  await useForm
    .getByRole('combobox', { name: 'Fuel catalog version', exact: true })
    .selectOption({ label: 'POWER · Grid power · ELECTRICITY · v1' });
  await useForm.getByRole('button', { name: 'Save site end use', exact: true }).click();
  await expect(pricing.getByText('LIGHTING · Lighting · ELECTRICITY', { exact: true })).toBeVisible();
  await expect(useForm.getByLabel('End-use code', { exact: true })).toHaveValue('');
  await pricing.getByRole('button', { name: 'Add tariff', exact: true }).click();
  const tariffForm = pricing.getByRole('form', { name: 'Add tariff', exact: true });
  await tariffForm
    .getByRole('combobox', { name: 'Tariff end use', exact: true })
    .selectOption({ label: 'LIGHTING · Lighting · ELECTRICITY' });
  await tariffForm.getByLabel('Tariff name', { exact: true }).fill('Synthetic electricity tariff');
  await tariffForm.getByLabel('Tariff first day', { exact: true }).fill('2021-01-01');
  await tariffForm.getByLabel('Tariff last day (inclusive)', { exact: true }).fill('2021-12-31');
  await tariffForm.getByLabel('Tariff currency', { exact: true }).fill('gbp');
  await tariffForm.getByRole('combobox', { name: 'Rate unit', exact: true }).selectOption('kWh');
  await tariffForm.getByRole('combobox', { name: 'Rate tax basis', exact: true }).selectOption('NET');
  await tariffForm.getByLabel('Tariff VAT percentage', { exact: true }).fill('20');
  await tariffForm.getByLabel('Tariff timezone', { exact: true }).fill('Europe/London');
  await tariffForm.getByLabel('Tariff source', { exact: true }).fill('Synthetic supplier rate card');
  await tariffForm.getByLabel('Band name', { exact: true }).fill('All day');
  await tariffForm.getByLabel('Band rate', { exact: true }).fill('0.15');
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    await tariffForm.getByLabel(day, { exact: true }).check();
  await tariffForm.getByRole('button', { name: 'Save tariff', exact: true }).click();
  await expect(pricing.getByText('Synthetic electricity tariff · Revision 1', { exact: true })).toBeVisible();
  await expect(pricing.getByRole('cell', { name: '0.15 GBP/kWh', exact: true })).toBeVisible();
  await pricing.getByRole('button', { name: 'Correct tariff', exact: true }).click();
  const tariffCorrection = pricing.getByRole('form', { name: 'Correct tariff', exact: true });
  await tariffCorrection.getByLabel('Band rate', { exact: true }).fill('0.2');
  await tariffCorrection
    .getByLabel('Tariff correction reason', { exact: true })
    .fill('Correct synthetic supplier rate');
  await tariffCorrection.getByRole('button', { name: 'Save tariff correction', exact: true }).click();
  await expect(pricing.getByText('Synthetic electricity tariff · Revision 2', { exact: true })).toBeVisible();
  await pricing.getByRole('button', { name: 'Correct tariff', exact: true }).click();
  await tariffCorrection.getByLabel('Band rate', { exact: true }).fill('0.9');
  await tariffCorrection.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(tariffCorrection).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await expect(pricing.getByRole('cell', { name: '0.2 GBP/kWh', exact: true })).toBeVisible();
  await pricing.getByRole('button', { name: 'View tariff history', exact: true }).click();
  await expect(pricing.getByRole('cell', { name: '0.15 GBP/kWh', exact: true })).toBeVisible();
  await pricing.screenshot({ path: testInfo.outputPath('tariff-history.png') });
  const occupancy = page.getByRole('region', { name: 'Occupancy history', exact: true });
  const occupancyForm = occupancy.getByRole('form', { name: 'Add occupancy', exact: true });
  await occupancyForm.getByLabel('Occupancy end use').selectOption('LIGHTING');
  await occupancyForm.getByLabel('Occupancy first day').fill('2021-01-01');
  await occupancyForm.getByLabel('Occupancy last day (inclusive)').fill('2021-01-31');
  await occupancyForm.getByLabel('Regular occupants', { exact: true }).fill('0');
  await occupancyForm.getByLabel('Occupancy source', { exact: true }).fill('Reviewed attendance register');
  await occupancyForm.getByRole('button', { name: 'Save occupancy', exact: true }).click();
  await expect(occupancy.getByText('Regular: 0 · Irregular: Unknown · Revision 1', { exact: true })).toBeVisible();
  await expect(occupancyForm.getByLabel('Regular occupants', { exact: true })).toHaveValue('');
  await occupancy.getByRole('button', { name: 'Correct occupancy', exact: true }).click();
  const occupancyCorrection = occupancy.getByRole('form', { name: 'Correct occupancy', exact: true });
  await occupancyCorrection.getByLabel('Regular occupants', { exact: true }).fill('12');
  await occupancyCorrection.getByLabel('Irregular occupants', { exact: true }).fill('3');
  await occupancyCorrection.getByLabel('Occupancy correction reason').fill('Corrected register');
  await occupancyCorrection.getByRole('button', { name: 'Save occupancy correction', exact: true }).click();
  await expect(occupancy.getByText('Regular: 12 · Irregular: 3 · Revision 2', { exact: true })).toBeVisible();
  await occupancy.getByRole('button', { name: 'View occupancy history', exact: true }).click();
  await expect(occupancy.getByText(/Revision 1: regular 0, irregular Unknown/)).toBeVisible();
  await occupancy.getByRole('button', { name: 'Correct occupancy', exact: true }).click();
  await occupancyCorrection.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(occupancyCorrection).toHaveCount(0);
  const occupancyBook = new ExcelJS.Workbook();
  const occupancySheet = occupancyBook.addWorksheet('Occupancy');
  occupancySheet.addRow([
    'firstDay',
    'lastDay',
    'energyUseCode',
    'regularCount',
    'irregularCount',
    'source',
    'legacySource',
    'legacyId',
  ]);
  occupancySheet.addRow([
    '2021-02-01',
    '2021-02-28',
    'LIGHTING',
    '10',
    '0',
    'February register',
    'synthetic',
    'tenant-02',
  ]);
  await occupancy.getByLabel('Occupancy workbook', { exact: true }).setInputFiles({
    name: 'occupancy.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await occupancyBook.xlsx.writeBuffer()),
  });
  await occupancy.getByRole('button', { name: 'Preview occupancy workbook', exact: true }).click();
  await expect(
    occupancy.getByText('Occupancy import: READY · 1 source rows · 1 parsed rows · 0 errors', { exact: true }),
  ).toBeVisible();
  await occupancy.getByLabel('I confirm the site, end uses, inclusive periods and separate occupant counts.').check();
  await occupancy.getByRole('button', { name: 'Commit occupancy import', exact: true }).click();
  await expect(occupancy.getByText('Regular: 10 · Irregular: 0 · Revision 1', { exact: true })).toBeVisible();
  await occupancy.screenshot({ path: testInfo.outputPath('occupancy-history.png') });

  await catalogPanel.getByRole('button', { name: 'Correct catalog entry', exact: true }).click();
  const catalogCorrection = catalogPanel.getByRole('form', { name: 'Correct catalog entry', exact: true });
  await catalogCorrection.getByLabel('Catalog label', { exact: true }).fill('Electricity supply');
  await catalogCorrection
    .getByLabel('Catalog correction reason', { exact: true })
    .fill('Correct supplier display label');
  await catalogCorrection.getByRole('button', { name: 'Save catalog correction', exact: true }).click();
  await expect(catalogPanel.getByText('FUEL · POWER · Electricity supply · Revision 2', { exact: true })).toBeVisible();
  const electricityRow = page.getByRole('row').filter({ hasText: 'Main electricity' }).filter({ hasText: '2021-01' });
  await electricityRow.getByRole('button', { name: 'Correct reading', exact: true }).click();
  const linkForm = page.getByRole('form', { name: 'Correct monthly reading', exact: true });
  await linkForm.getByRole('combobox', { name: 'Corrected registered end use', exact: true }).selectOption('LIGHTING');
  await linkForm
    .getByLabel('Reading correction reason', { exact: true })
    .fill('Link original reading to reviewed site use');
  await linkForm.getByRole('button', { name: 'Save reading correction', exact: true }).click();
  await expect(electricityRow.getByText('Registered end use: LIGHTING · Lighting', { exact: true })).toBeVisible();
  await expect(page.getByText('Main electricity · 12/12 months recorded', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records', exact: true }).click();
  await electricityRow.getByRole('button', { name: 'View reading history', exact: true }).click();
  await expect(electricityRow.getByText('Saved fuel catalog: Grid power · revision 1', { exact: true })).toBeVisible();
  await expect(electricityRow.getByText('Registered end use: Unlinked', { exact: true })).toBeVisible();
  await electricityRow.screenshot({ path: testInfo.outputPath('catalog-reading-history.png') });
});

test('Sprint 3 operating patterns, corrections and reviewed import', async ({ page }, testInfo) => {
  await page.goto('/login');
  await signIn(page, `patterns-${randomUUID()}@example.test`);
  await page.getByLabel('Organisation name').fill('Pattern Workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/org\/[^/]+\/overview$/);
  const org = new URL(page.url()).pathname.split('/')[2];
  const headers = { origin: 'http://localhost:3101' };
  const response = await page.request.post(`/api/v1/organisations/${org}/sites`, {
    headers,
    data: { code: 'PAT', name: 'Pattern Site' },
  });
  expect(response.ok()).toBe(true);
  const site = await response.json();
  const use = await page.request.post(`/api/v1/organisations/${org}/sites/${site.id}/energy/tariffs/uses`, {
    headers,
    data: { code: 'HEAT', name: 'Heating', fuel: 'ELECTRICITY', source: 'Reviewed end use' },
  });
  expect(use.ok()).toBe(true);
  await page.getByRole('link', { name: 'Energy', exact: true }).click();
  await page.getByLabel('Year', { exact: true }).fill('2020');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  const panel = page.getByRole('region', { name: 'Operating patterns', exact: true });
  const form = panel.getByRole('form', { name: 'Add pattern', exact: true });
  await form.getByLabel('Pattern end use').selectOption('HEAT');
  await form.getByLabel('Pattern first day').fill('2020-01-01');
  await form.getByLabel('Pattern last day (inclusive)').fill('2020-01-31');
  await form.getByLabel('Annual active days').fill('250');
  await form.getByLabel('Pattern temperature').fill('18.5');
  await form.getByLabel('Pattern source', { exact: true }).fill('Legacy pattern review');
  await form.getByRole('button', { name: 'Save pattern', exact: true }).click();
  await expect(panel.getByText(/Annual active days: 250/)).toBeVisible();
  await expect(panel.getByText(/Temperature unit or context is unresolved/)).toBeVisible();
  await expect(form.getByLabel('Annual active days')).toHaveValue('');
  await panel.getByRole('button', { name: 'Correct pattern', exact: true }).click();
  const correction = panel.getByRole('form', { name: 'Correct pattern', exact: true });
  await correction.getByLabel('Temperature unit').selectOption('C');
  await correction.getByLabel('Temperature context').selectOption('HEATING');
  await correction.getByLabel('Pattern last day (inclusive)').fill('2020-12-31');
  await correction
    .getByLabel('Pattern correction reason')
    .fill('Confirmed annual validity and Celsius heating setpoint');
  await correction.getByRole('button', { name: 'Save pattern correction', exact: true }).click();
  await expect(panel.getByText(/HEATING · Revision 2/)).toBeVisible();
  await expect(panel.getByText(/Temperature unit or context is unresolved/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'View pattern history', exact: true }).click();
  await expect(panel.getByText(/Revision 1: 2020-01-01 to 2020-01-31/)).toBeVisible();
  await panel.getByRole('button', { name: 'Correct pattern', exact: true }).click();
  await correction.getByRole('button', { name: 'Cancel', exact: true }).click();
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Patterns');
  sheet.addRow([
    'firstDay',
    'lastDay',
    'energyUseCode',
    'daysOnYear',
    'temperature',
    'temperatureUnit',
    'temperatureContext',
    'source',
    'legacySource',
    'legacyId',
  ]);
  sheet.addRow([
    '2021-01-01',
    '2021-12-31',
    'HEAT',
    '0',
    '0',
    'C',
    'HEATING',
    'Reviewed workbook',
    'synthetic',
    'pattern-2021',
  ]);
  for (const name of ['Consumption', 'Drivers', 'Emissions', 'Targets'])
    book.addWorksheet(name).addRows([['Unselected'], ['Retain outside batch']]);
  await panel.getByLabel('Pattern workbook', { exact: true }).setInputFiles({
    name: 'patterns.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  const mappingDownload = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download patterns mapping template v1' }).click();
  const mappingFile = await (await mappingDownload).path();
  expect(mappingFile).toBeTruthy();
  await panel.getByLabel('Saved mapping template (optional)').setInputFiles(mappingFile!);
  await panel.getByRole('button', { name: 'Preview pattern workbook', exact: true }).click();
  await expect(
    panel.getByText('Pattern import: READY · 1 source rows · 1 parsed rows · 0 errors', { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(/Selected sheet: Patterns. Excluded sheets: Consumption, Drivers, Emissions, Targets/),
  ).toBeVisible();
  const savedDownload = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Save this mapping template' }).click();
  expect((await savedDownload).suggestedFilename()).toBe('patterns-mapping-v1.json');
  await panel.screenshot({ path: testInfo.outputPath('named-sheet-template-preview.png') });
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Commit pattern import', exact: true }).click();
  await expect(panel.getByText(/Pattern import: COMMITTED/)).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2021');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  await expect(panel.getByText(/Annual active days: 0 · Temperature: 0 C/)).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath('operating-patterns.png') });
});

test('Sprint 3 operational events and log import', async ({ page }, testInfo) => {
  await page.goto('/login');
  await signIn(page, `events-${randomUUID()}@example.test`);
  await page.getByLabel('Organisation name').fill('Event Workspace');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/org\/[^/]+\/overview$/);
  const org = new URL(page.url()).pathname.split('/')[2];
  const headers = { origin: 'http://localhost:3101' };
  const response = await page.request.post(`/api/v1/organisations/${org}/sites`, {
    headers,
    data: { code: 'LOG', name: 'Event Site' },
  });
  expect(response.ok()).toBe(true);
  const site = await response.json();
  const use = await page.request.post(`/api/v1/organisations/${org}/sites/${site.id}/energy/tariffs/uses`, {
    headers,
    data: { code: 'HEAT', name: 'Heating', fuel: 'ELECTRICITY', source: 'Reviewed end use' },
  });
  expect(use.ok()).toBe(true);
  await page.getByRole('link', { name: 'Energy', exact: true }).click();
  await page.getByLabel('Year', { exact: true }).fill('2020');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  const panel = page.getByRole('region', { name: 'Operational events', exact: true });
  const form = panel.getByRole('form', { name: 'Add event', exact: true });
  await form.getByLabel('Event end use').selectOption('HEAT');
  await form.getByLabel('Event first day').fill('2020-01-01');
  await form.getByLabel('Event last day (inclusive)').fill('2020-01-31');
  await form.getByLabel('Event code', { exact: true }).fill('log-01');
  await form.getByLabel('Operation', { exact: true }).fill('Plant shutdown');
  await expect(form.getByLabel('Event comments')).toHaveCSS('border-top-width', '1px');
  await form.getByLabel('Event comments').fill('<script>evidence, not code</script>');
  await form.getByLabel('Event source', { exact: true }).fill('Maintenance log');
  await form.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(panel.getByText('Plant shutdown · Revision 1', { exact: true })).toBeVisible();
  await expect(panel.getByText('<script>evidence, not code</script>', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Event code', { exact: true })).toHaveValue('');
  await panel.getByRole('button', { name: 'Correct event', exact: true }).click();
  const correction = panel.getByRole('form', { name: 'Correct event', exact: true });
  await correction.getByLabel('Event last day (inclusive)').fill('2020-02-01');
  await correction.getByLabel('Event comments').fill('Confirmed shutdown interval');
  await correction.getByLabel('Event correction reason').fill('Reviewed engineer log');
  await correction.getByRole('button', { name: 'Save event correction', exact: true }).click();
  await expect(panel.getByText('Plant shutdown · Revision 2', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'View event history', exact: true }).click();
  await expect(panel.getByText(/Revision 1: 2020-01-01 to 2020-01-31/)).toBeVisible();
  await panel.getByRole('button', { name: 'Correct event', exact: true }).click();
  await correction.getByRole('button', { name: 'Cancel', exact: true }).click();
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet('Logs');
  sheet.addRow([
    'firstDay',
    'lastDay',
    'energyUseCode',
    'eventCode',
    'operation',
    'comments',
    'source',
    'legacySource',
    'legacyId',
  ]);
  sheet.addRow([
    '2020-01-15',
    '2020-01-16',
    'HEAT',
    'LOG-02',
    'Maintenance',
    'Overlapping event',
    'Engineer log',
    'synthetic',
    'log-2',
  ]);
  await panel.getByLabel('Event workbook', { exact: true }).setInputFiles({
    name: 'events.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await panel.getByRole('button', { name: 'Preview event workbook', exact: true }).click();
  await expect(
    panel.getByText('Event import: READY · 1 source rows · 1 parsed rows · 0 errors', { exact: true }),
  ).toBeVisible();
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Commit event import', exact: true }).click();
  await expect(panel.getByText('Maintenance · Revision 1', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Year', { exact: true }).fill('2020');
  await page.getByRole('button', { name: 'Load energy records' }).click();
  await expect(panel.getByText('Plant shutdown · Revision 2', { exact: true })).toBeVisible();
  await expect(panel.getByText('Maintenance · Revision 1', { exact: true })).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath('operational-events.png') });
});
