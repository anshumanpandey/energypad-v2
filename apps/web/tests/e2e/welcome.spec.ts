import { test, expect } from './fixtures/isolated-user';

test('landing page opens overview, with login and onboarding for users who need them', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  const response = await page.request.post('/api/v1/organisations', {
    headers: { origin: 'http://localhost:3101' },
    data: { name: 'Landing workspace', currency: 'GBP', timezone: 'UTC' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const org = await response.json();
  await page.goto('/');
  await expect(page).toHaveURL(`/org/${org.id}/overview`);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

  const signedOut = await browser.newContext();
  try {
    const visitor = await signedOut.newPage();
    await visitor.goto('http://localhost:3101/');
    await expect(visitor).toHaveURL(/\/login\?callbackUrl=%2F$/);
    await expect(visitor.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
  } finally {
    await signedOut.close();
  }
});
