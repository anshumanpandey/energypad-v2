import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { testDatabase } from './test-database';
const { databaseUrl, cleanup } = await testDatabase();
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
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', () => {
  if (!stopping) void cleanup().finally(() => process.exit(1));
});
