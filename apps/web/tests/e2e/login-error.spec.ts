import { test, expect } from '@playwright/test';

test('login errors show once and do not persist after refresh', async ({ page }) => {
  for (const error of ['Signin', 'Signin', 'InvalidEmail']) {
    await page.goto(`/login?error=${error}&callbackUrl=%2Finvite%2Fexample#login`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      error === 'InvalidEmail' ? 'Enter a valid email address.' : 'We couldn’t sign you in.',
    );
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Finvite%2Fexample#login$/);
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue('/invite/example');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue('/invite/example');
  }
});
