import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { createDatabase } from '../src/server/db';
import { plans } from '../src/domain/policy';

// Each run owns a new database. Never resets the application's DATABASE_URL.
export async function testDatabase() {
  const name = `energiepad_test_${randomBytes(6).toString('hex')}`;
  let postgres: EmbeddedPostgres | undefined;
  let directory: string | undefined;
  let adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) {
    const server = createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('No test port');
        server.close(() => resolve(address.port));
      });
    });
    directory = await mkdtemp(path.join(tmpdir(), 'energiepad-pg-'));
    const password = randomBytes(18).toString('hex');
    postgres = new EmbeddedPostgres({
      databaseDir: directory,
      user: 'energiepad',
      password,
      port,
      persistent: false,
      authMethod: 'scram-sha-256',
      postgresFlags: ['-h', '127.0.0.1', '-k', directory],
      initdbFlags: ['--locale=C', '--encoding=UTF8'],
      onLog: () => {},
      onError: () => {},
    });
    await postgres.initialise();
    await postgres.start();
    adminUrl = `postgresql://energiepad:${password}@127.0.0.1:${port}/postgres`;
  }
  const admin = new Client({ connectionString: adminUrl });
  // The embedded cluster also shuts down on process signals; handle idle-client errors.
  admin.on('error', () => {});
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const databaseUrl = url.toString();
  const db = createDatabase(databaseUrl);
  async function cleanup() {
    await db.$disconnect();
    if (!postgres) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    if (postgres) await postgres.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    for (const plan of plans) await db.plan.create({ data: plan });
    return { db, databaseUrl, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
