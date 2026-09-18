import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
  await expect(member.getByRole('heading', { name: 'No sites assigned yet' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Your portfolio starts here' })).toBeVisible();
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
