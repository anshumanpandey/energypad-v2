import { mkdir, writeFile, rm } from 'node:fs/promises';
import { seedMultidriver } from './fixtures/analysis-multidriver';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { testDatabase } from './test-database';
const { db, databaseUrl, cleanup } = await testDatabase();
const manifestPath = '.local/e2e-multidriver.json';
try {
  const fixture = await seedMultidriver(db);
  await mkdir('.local', { recursive: true });
  await writeFile(manifestPath, JSON.stringify(fixture), { mode: 0o600 });
} catch (error) {
  await cleanup();
  throw error;
}
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3101'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_URL: 'http://localhost:3101',
      AUTH_SECRET: randomBytes(32).toString('base64url'),
      RESEND_API_KEY: '',
      NODE_ENV: 'development',
      E2E_DIST_DIR: '.next-e2e',
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once('exit', () => resolve());
  });
  await cleanup();
  await rm(manifestPath, { force: true });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', () => {
  if (!stopping) void cleanup().finally(() => process.exit(1));
});
