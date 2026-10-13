import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../../src/server/db';

// A fresh account per test attempt keeps organisation quotas and retries independent.
// The E2E server owns this disposable database and removes it after the suite.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    const { databaseUrl } = JSON.parse(await readFile('.local/e2e-database.json', 'utf8'));
    const db = createDatabase(databaseUrl);
    const sessionToken = randomUUID() + randomUUID();
    try {
      const [database] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
      if (!database.name.startsWith('energiepad_test_'))
        throw new Error('Isolated browser accounts require a disposable test database.');
      await db.user.create({
        data: {
          email: `isolated-${randomUUID()}@example.test`,
          emailVerified: new Date(),
          sessions: { create: { sessionToken, expires: new Date(Date.now() + 86400000) } },
        },
      });
    } finally {
      await db.$disconnect();
    }
    await page.context().addCookies([
      {
        name: 'authjs.session-token',
        value: sessionToken,
        url: 'http://localhost:3101',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const organisations = await page.request.get('/api/v1/organisations');
    expect(organisations.ok()).toBe(true);
    expect(await organisations.json()).toEqual([]);
    await providePage(page);
  },
});
export { expect };
