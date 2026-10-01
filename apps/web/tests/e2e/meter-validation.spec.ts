import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('meter validation names, highlights and focuses the invalid field', async ({ page }) => {
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
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin: 'http://localhost:3101' } });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const org = await post('organisations', { name: 'Meter validation workspace', currency: 'GBP', timezone: 'UTC' });
  await post(`organisations/${org.id}/sites`, { code: 'abc', name: 'Meter validation site' });
  await page.goto(`/org/${org.id}/sites`);
  await page.getByRole('button', { name: 'View site', exact: true }).click();
  await page.getByRole('button', { name: 'Add Meter', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'New meter', exact: true }) });
  await form.getByLabel('Meter code', { exact: true }).fill('G');
  await form.getByLabel('Meter name', { exact: true }).fill('x');
  await form.getByRole('button', { name: 'Add meter', exact: true }).click();
  const name = form.locator('input[name="name"]');
  await expect(form.getByRole('alert')).toContainText('Meter name must contain at least 2 characters.');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription('Meter name must contain at least 2 characters.');
  await name.fill('Gas meter');
  await form.getByRole('button', { name: 'Add meter', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New meter' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Meter saved successfully.');
  await expect(page.getByRole('heading', { name: 'Edit meter', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Meter', exact: true }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'false');
  await expect(name).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Meter', exact: true })).toBeFocused();
});
