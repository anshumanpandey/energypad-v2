import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

if (process.env.NODE_ENV === 'production') throw new Error('Local services are for development only.');
const directory = path.resolve('.local/postgres');
await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
if (!existsSync('.env')) {
  await writeFile(
    '.env',
    `DATABASE_URL=postgresql://energiepad:local-only@127.0.0.1:55432/energiepad_v2\nAUTH_URL=http://localhost:3100\nAUTH_SECRET=${randomBytes(32).toString('base64url')}\nEMAIL_FROM=EnergiePad <hello@energiepad.local>\n`,
    { mode: 0o600, flag: 'wx' },
  );
  console.log('Created private .env with a random session secret.');
}
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'energiepad',
  password: 'local-only',
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', directory],
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(path.join(directory, 'PG_VERSION'))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient('postgres', '127.0.0.1');
await client.connect();
if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = 'energiepad_v2'")).rowCount)
  await client.query('CREATE DATABASE "energiepad_v2"');
await client.end();
console.log(
  'Local PostgreSQL ready on 127.0.0.1:55432 (energiepad_v2).\nRun npm run db:migrate && npm run db:seed, then npm run dev in another terminal.\nDevelopment email is captured in .local/mail. Ctrl-C stops PostgreSQL; data is retained.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60_000);
